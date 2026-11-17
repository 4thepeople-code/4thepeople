/**
 * OutboxRunner
 *
 * Production execution runner for the transactional email outbox.
 * Processes pending jobs in `email_outbox` using `OutboxWorker` and `BrevoEmailAdapter`.
 *
 * Concurrency & Reliability Guarantees:
 * 1. Safe Concurrent Execution:
 *    Claims jobs via `public.fn_outbox_claim()` which executes `FOR UPDATE SKIP LOCKED`.
 *    Multiple worker instances (or multiple server processes) can run simultaneously
 *    without collisions or race conditions.
 * 2. Lease-Fenced Delivery:
 *    Every claim is assigned a distinct `claim_token` UUID and lease timeout (`locked_until`).
 *    Completion (`fn_outbox_complete`) and failure (`fn_outbox_fail`) enforce fence validation.
 * 3. Exponential Backoff & Dead-Lettering:
 *    Failed attempts increment `attempts` count. When `attempts >= max_attempts`, the job
 *    is atomically transitioned to `FAILED` status and sensitive payload is redacted.
 * 4. Stale Job Reaping:
 *    Periodic execution of `fn_outbox_expire()` reclaims un-sent expired jobs.
 * 5. Flexible Deployment Modes:
 *    - Standalone worker process: `npm run worker:outbox` (recommended for production).
 *    - In-process background loop: `ENABLE_IN_PROCESS_OUTBOX_WORKER=true` in `backend/index.js`.
 *    - Single-shot execution: `node workers/outboxRunner.js --once` (for scheduled cron runners).
 */

const dotenv = require('dotenv');
if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

const { OutboxWorker, MockEmailAdapter } = require('./outboxWorker');
const { BrevoEmailAdapter } = require('./brevoEmailAdapter');

/**
 * Creates and configures an OutboxWorker instance based on environment.
 */
function createOutboxWorker(options = {}) {
  let emailAdapter = options.emailAdapter;
  if (!emailAdapter) {
    if (process.env.NODE_ENV === 'test' && !options.useBrevo) {
      emailAdapter = new MockEmailAdapter();
    } else {
      emailAdapter = new BrevoEmailAdapter();
    }
  }

  const explicitUrl =
    typeof options.databaseUrl === 'string'
      ? options.databaseUrl.trim()
      : options.databaseUrl;

  const envUrl =
    typeof process.env.OUTBOX_WORKER_DATABASE_URL === 'string'
      ? process.env.OUTBOX_WORKER_DATABASE_URL.trim()
      : '';

  const workerUrl = explicitUrl || envUrl;

  if (!workerUrl) {
    throw new Error(
      '[OutboxWorker] Missing required environment variable OUTBOX_WORKER_DATABASE_URL. ' +
      'The outbox worker must connect using dedicated credentials (yuva_outbox_worker) ' +
      'and cannot fall back to DATABASE_URL.'
    );
  }

  const leaseSeconds =
    Number(options.leaseSeconds || process.env.OUTBOX_LEASE_SECONDS) || 120;

  return new OutboxWorker({
    databaseUrl: workerUrl,
    emailAdapter,
    leaseSeconds,
  });
}

/**
 * Executes a single batch of outbox processing.
 *
 * @param {OutboxWorker} worker
 * @param {Object} [options]
 * @param {number} [options.batchSize=10]
 * @returns {Promise<{ claimed: number, delivered: number, failed: number }>}
 */
async function processBatch(worker, options = {}) {
  const batchSize =
    Number(options.batchSize || process.env.OUTBOX_BATCH_SIZE) || 10;

  const jobs = await worker.claimJobs(batchSize);
  if (!jobs || jobs.length === 0) {
    return { claimed: 0, delivered: 0, failed: 0 };
  }

  let delivered = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const result = await worker.processJob(job);
      if (result.success) {
        delivered++;
      } else {
        failed++;
        console.warn(
          `[OutboxWorker] Job ${job.id} failed attempt (${job.attempts}/${result.fenceOk ? 'fenced' : 'unfenced'}): ${result.error}`
        );
      }
    } catch (err) {
      failed++;
      console.error(`[OutboxWorker] Unexpected error processing job ${job.id}:`, err.message);
    }
  }

  return { claimed: jobs.length, delivered, failed };
}

let activeLoopTimeout = null;
let isLoopRunning = false;
let activeWorker = null;
let activeTickPromise = null;
let shutdownPromise = null;

/**
 * Starts a continuous polling worker loop.
 */
function startOutboxWorkerLoop(options = {}) {
  if (isLoopRunning || shutdownPromise || activeTickPromise) {
    console.warn('[OutboxWorker] Loop is already running or shutting down.');
    return;
  }

  const pollIntervalMs =
    Number(options.pollIntervalMs || process.env.OUTBOX_POLL_INTERVAL_MS) || 2000;
  const reaperIntervalMs =
    Number(options.reaperIntervalMs || process.env.OUTBOX_REAPER_INTERVAL_MS) || 60000;

  activeWorker = options.worker || createOutboxWorker(options);
  isLoopRunning = true;
  shutdownPromise = null;

  let lastReaperRun = 0;

  console.log(
    `[OutboxWorker] Starting background worker loop (poll: ${pollIntervalMs}ms, reaper: ${reaperIntervalMs}ms)...`
  );

  async function runTick() {
    if (!isLoopRunning || shutdownPromise) return;

    try {
      const now = Date.now();
      if (now - lastReaperRun >= reaperIntervalMs) {
        lastReaperRun = now;
        try {
          const expiredCount = await activeWorker.runReaper();
          if (expiredCount > 0) {
            console.log(`[OutboxWorker] Reaper expired ${expiredCount} stale jobs.`);
          }
        } catch (reaperErr) {
          console.warn('[OutboxWorker] Reaper execution error:', reaperErr.message);
          if (!isLoopRunning || shutdownPromise || options.throwOnTickError) {
            throw reaperErr;
          }
        }
      }

      // Check shutdown status before claiming a new batch
      if (!isLoopRunning || shutdownPromise) return;

      const stats = await processBatch(activeWorker, options);

      // If jobs were processed and more may be waiting, poll immediately
      const nextDelay = stats.claimed > 0 ? 100 : pollIntervalMs;
      if (isLoopRunning && !shutdownPromise) {
        activeLoopTimeout = setTimeout(scheduleNextTick, nextDelay);
      }
    } catch (err) {
      console.error('[OutboxWorker] Polling loop error:', err.message);
      if (isLoopRunning && !shutdownPromise) {
        activeLoopTimeout = setTimeout(scheduleNextTick, pollIntervalMs);
        if (options.throwOnTickError) {
          throw err;
        }
      } else {
        throw err;
      }
    }
  }

  function scheduleNextTick() {
    activeLoopTimeout = null;
    if (!isLoopRunning || shutdownPromise || activeTickPromise) return;

    activeTickPromise = (async () => {
      await runTick();
    })().finally(() => {
      activeTickPromise = null;
    });
  }

  scheduleNextTick();
}

/**
 * Gracefully stops the worker loop, drains in-flight processing, and disconnects database client.
 * Idempotent: concurrent calls share the same in-flight shutdown promise.
 *
 * @returns {Promise<void>}
 */
function stopOutboxWorkerLoop() {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  if (!isLoopRunning && !activeWorker && !activeTickPromise) {
    return Promise.resolve();
  }

  console.log('[OutboxWorker] Stopping worker loop...');
  isLoopRunning = false;

  if (activeLoopTimeout) {
    clearTimeout(activeLoopTimeout);
    activeLoopTimeout = null;
  }

  shutdownPromise = (async () => {
    try {
      // Drain currently executing tick and its complete batch of claimed jobs
      if (activeTickPromise) {
        console.log('[OutboxWorker] Awaiting in-flight worker tick and batch processing...');
        try {
          await activeTickPromise;
        } catch (tickErr) {
          console.warn('[OutboxWorker] In-flight tick error during shutdown drain:', tickErr.message);
        }
      }

      // Disconnect Prisma client only after active tick has settled
      if (activeWorker) {
        try {
          await activeWorker.disconnect();
        } catch (err) {
          console.warn('[OutboxWorker] Error disconnecting worker prisma:', err.message);
        } finally {
          activeWorker = null;
        }
      }

      activeTickPromise = null;
      console.log('[OutboxWorker] Worker loop stopped.');
    } finally {
      shutdownPromise = null;
    }
  })();

  return shutdownPromise;
}

/**
 * CLI Entrypoint
 */
async function main() {
  const args = process.argv.slice(2);
  const isOnce = args.includes('--once');

  if (isOnce) {
    console.log('[OutboxWorker] Running single-shot batch execution (--once)...');
    const worker = createOutboxWorker();
    try {
      const reaperCount = await worker.runReaper();
      if (reaperCount > 0) {
        console.log(`[OutboxWorker] Reaper expired ${reaperCount} stale jobs.`);
      }

      const stats = await processBatch(worker);
      console.log(
        `[OutboxWorker] Single-shot completed: claimed=${stats.claimed}, delivered=${stats.delivered}, failed=${stats.failed}`
      );
    } finally {
      await worker.disconnect();
    }
    process.exit(0);
  }

  // Continuous loop mode
  startOutboxWorkerLoop();

  const handleShutdown = async (signal) => {
    console.log(`\n[OutboxWorker] Received ${signal}, shutting down gracefully...`);
    await stopOutboxWorkerLoop();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[OutboxWorker] Fatal startup error:', err);
    process.exit(1);
  });
}

module.exports = {
  createOutboxWorker,
  processBatch,
  startOutboxWorkerLoop,
  stopOutboxWorkerLoop,
  getActiveTickPromise: () => activeTickPromise,
  getActiveWorker: () => activeWorker,
  isWorkerLoopRunning: () => isLoopRunning,
  getShutdownPromise: () => shutdownPromise,
};
