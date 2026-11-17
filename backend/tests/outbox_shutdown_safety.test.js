const assert = require('assert');
const {
  createOutboxWorker,
  processBatch,
  startOutboxWorkerLoop,
  stopOutboxWorkerLoop,
  getActiveTickPromise,
  getActiveWorker,
  isWorkerLoopRunning,
} = require('../workers/outboxRunner');

process.env.NODE_ENV = 'test';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testA_inFlightEmail() {
  console.log('\n--- Running Test A: In-flight email drainage ---');
  let resolveJob;
  const jobDeferred = new Promise((resolve) => {
    resolveJob = resolve;
  });

  let disconnectCalled = false;
  let jobCompleted = false;
  let disconnectOrderValid = false;

  const mockWorker = {
    claimJobs: async () => {
      return [{ id: 'job-test-a', attempts: 1 }];
    },
    processJob: async () => {
      await jobDeferred;
      jobCompleted = true;
      return { success: true };
    },
    runReaper: async () => 0,
    disconnect: async () => {
      disconnectCalled = true;
      if (jobCompleted) {
        disconnectOrderValid = true;
      }
    },
  };

  startOutboxWorkerLoop({ worker: mockWorker, pollIntervalMs: 10000 });

  await delay(20);
  assert(getActiveTickPromise() !== null, 'Active tick should be running');

  const shutdownPromise = stopOutboxWorkerLoop();

  assert.strictEqual(disconnectCalled, false, 'Prisma disconnect() MUST NOT be called while job is in-flight');
  assert.strictEqual(jobCompleted, false, 'Job should still be in progress');

  resolveJob();
  await shutdownPromise;

  assert.strictEqual(jobCompleted, true, 'Job processing must complete');
  assert.strictEqual(disconnectCalled, true, 'Prisma disconnect must be called after job completion');
  assert.strictEqual(disconnectOrderValid, true, 'Completion path must finish BEFORE Prisma disconnects');
  assert.strictEqual(getActiveTickPromise(), null, 'Active tick reference must be cleared');
  assert.strictEqual(getActiveWorker(), null, 'Active worker reference must be cleared');
  assert.strictEqual(isWorkerLoopRunning(), false, 'Worker loop running flag must be false');
  console.log('✓ Test A Passed: Prisma did not disconnect until in-flight email processing completed.');
}

async function testB_inFlightReaper() {
  console.log('\n--- Running Test B: In-flight reaper drainage ---');
  let resolveReaper;
  const reaperDeferred = new Promise((resolve) => {
    resolveReaper = resolve;
  });

  let disconnectCalled = false;
  let reaperCompleted = false;
  let claimJobsCalled = false;

  const mockWorker = {
    runReaper: async () => {
      await reaperDeferred;
      reaperCompleted = true;
      return 2;
    },
    claimJobs: async () => {
      claimJobsCalled = true;
      return [];
    },
    processJob: async () => ({ success: true }),
    disconnect: async () => {
      disconnectCalled = true;
    },
  };

  startOutboxWorkerLoop({ worker: mockWorker, reaperIntervalMs: 0, pollIntervalMs: 10000 });

  await delay(20);
  assert(getActiveTickPromise() !== null, 'Active tick should be executing reaper');

  const shutdownPromise = stopOutboxWorkerLoop();

  assert.strictEqual(disconnectCalled, false, 'Prisma disconnect() MUST NOT be called while reaper is in-flight');
  assert.strictEqual(reaperCompleted, false, 'Reaper should still be in progress');

  resolveReaper();
  await shutdownPromise;

  assert.strictEqual(reaperCompleted, true, 'Reaper must complete');
  assert.strictEqual(disconnectCalled, true, 'Prisma disconnect must be called after reaper settles');
  assert.strictEqual(claimJobsCalled, false, 'Should not claim jobs when shutdown was initiated during reaper');
  console.log('✓ Test B Passed: Prisma remained connected until the reaper settled.');
}

async function testC_noAdditionalPolling() {
  console.log('\n--- Running Test C: No additional polling after shutdown ---');
  let tickCount = 0;
  let resolveJob;
  const jobDeferred = new Promise((resolve) => {
    resolveJob = resolve;
  });

  const mockWorker = {
    claimJobs: async () => {
      tickCount++;
      return [{ id: 'job-c' }];
    },
    processJob: async () => {
      await jobDeferred;
      return { success: true };
    },
    runReaper: async () => 0,
    disconnect: async () => {},
  };

  startOutboxWorkerLoop({ worker: mockWorker, pollIntervalMs: 10 });

  await delay(20);
  assert.strictEqual(tickCount, 1, 'First tick should execute');

  const shutdownPromise = stopOutboxWorkerLoop();
  resolveJob();
  await shutdownPromise;

  await delay(50);
  assert.strictEqual(tickCount, 1, 'No additional ticks must be executed after shutdown begins');
  console.log('✓ Test C Passed: No subsequent tick was scheduled or executed.');
}

async function testD_concurrentShutdown() {
  console.log('\n--- Running Test D: Concurrent shutdown idempotency ---');
  let disconnectCount = 0;
  let resolveJob;
  const jobDeferred = new Promise((resolve) => {
    resolveJob = resolve;
  });

  const mockWorker = {
    claimJobs: async () => [{ id: 'job-d' }],
    processJob: async () => {
      await jobDeferred;
      return { success: true };
    },
    runReaper: async () => 0,
    disconnect: async () => {
      disconnectCount++;
    },
  };

  startOutboxWorkerLoop({ worker: mockWorker, pollIntervalMs: 10000 });
  await delay(20);

  const p1 = stopOutboxWorkerLoop();
  const p2 = stopOutboxWorkerLoop();
  const p3 = stopOutboxWorkerLoop();

  assert.strictEqual(p1, p2, 'Concurrent stopOutboxWorkerLoop calls must share identical shutdown promise');
  assert.strictEqual(p2, p3, 'Concurrent stopOutboxWorkerLoop calls must share identical shutdown promise');

  resolveJob();
  await Promise.all([p1, p2, p3]);

  assert.strictEqual(disconnectCount, 1, 'Prisma disconnect must be called exactly once');

  await stopOutboxWorkerLoop();
  assert.strictEqual(disconnectCount, 1, 'Subsequent shutdown call on stopped worker must be a no-op');
  console.log('✓ Test D Passed: Concurrent shutdowns shared identical promise; disconnect called exactly once.');
}

async function testE_tickFailure() {
  console.log('\n--- Running Test E: Tick failure recovery during shutdown ---');
  let disconnectCalled = false;
  let rejectClaim;
  const claimDeferred = new Promise((_, reject) => {
    rejectClaim = reject;
  });

  const mockWorker = {
    claimJobs: async () => {
      await claimDeferred;
      return [];
    },
    processJob: async () => ({ success: true }),
    runReaper: async () => 0,
    disconnect: async () => {
      disconnectCalled = true;
    },
  };

  startOutboxWorkerLoop({ worker: mockWorker, pollIntervalMs: 10000 });
  await delay(20);

  const shutdownPromise = stopOutboxWorkerLoop();
  assert.strictEqual(disconnectCalled, false, 'Prisma disconnect must not be called before failed tick settles');

  rejectClaim(new Error('Simulated database network timeout in claimJobs'));

  await shutdownPromise;

  assert.strictEqual(disconnectCalled, true, 'Prisma disconnect must be called even when active tick rejects');
  assert.strictEqual(getActiveTickPromise(), null, 'Active tick reference must be cleared');
  assert.strictEqual(getActiveWorker(), null, 'Active worker reference must be cleared');
  assert.strictEqual(isWorkerLoopRunning(), false, 'Worker loop running flag must be false');
  console.log('✓ Test E Passed: Shutdown completed cleanup and disconnected Prisma after tick rejection.');
}

async function testF_existingBehavior() {
  console.log('\n--- Running Test F: Existing behavior preservation ---');

  const processedOrder = [];
  const testJobs = [
    { id: 'job-1', attempts: 1 },
    { id: 'job-2', attempts: 2 },
    { id: 'job-3', attempts: 3 },
  ];

  const mockWorker = {
    claimJobs: async () => testJobs,
    processJob: async (job) => {
      processedOrder.push(job.id);
      if (job.id === 'job-2') {
        return { success: false, fenceOk: true, error: 'Simulated Brevo rate limit' };
      }
      return { success: true };
    },
    runReaper: async () => 0,
    disconnect: async () => {},
  };

  const stats = await processBatch(mockWorker, { batchSize: 5 });
  assert.deepStrictEqual(processedOrder, ['job-1', 'job-2', 'job-3'], 'Batch jobs must process in sequential order');
  assert.strictEqual(stats.claimed, 3, 'Claimed count should match');
  assert.strictEqual(stats.delivered, 2, 'Delivered count should match successful jobs');
  assert.strictEqual(stats.failed, 1, 'Failed count should match failed jobs');

  delete process.env.OUTBOX_WORKER_DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://app_user:pass@localhost:5432/db';
  assert.throws(
    () => createOutboxWorker(),
    /OUTBOX_WORKER_DATABASE_URL/,
    'createOutboxWorker must require OUTBOX_WORKER_DATABASE_URL and refuse DATABASE_URL'
  );

  const workerWithInjectedUrl = createOutboxWorker({ databaseUrl: 'postgresql://injected:pass@localhost:5432/test' });
  assert(workerWithInjectedUrl, 'Explicitly injected databaseUrl must be accepted');

  console.log('✓ Test F Passed: Batch order, retry accounting, and dedicated URL requirements preserved.');
}

async function runAllTests() {
  try {
    await testA_inFlightEmail();
    await testB_inFlightReaper();
    await testC_noAdditionalPolling();
    await testD_concurrentShutdown();
    await testE_tickFailure();
    await testF_existingBehavior();
    console.log('\n========================================================');
    console.log('🎉 ALL OUTBOX SHUTDOWN SAFETY TESTS (A through F) PASSED!');
    console.log('========================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILURE:', err);
    process.exit(1);
  }
}

runAllTests();
