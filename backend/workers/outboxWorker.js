const { PrismaClient } = require('@prisma/client');
const { decryptPayload } = require('../utils/cryptoUtils');

class MockEmailAdapter {
  constructor() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY VIOLATION: MockEmailAdapter cannot be used in production');
    }
    this.sentEmails = [];
    this.simulatedErrors = new Map(); // jobId -> Error
    this.idempotencyLog = new Set();
  }

  async sendEmail({ idempotencyKey, to, recipientName, templateType, params }) {
    if (this.simulatedErrors.has(idempotencyKey)) {
      const err = this.simulatedErrors.get(idempotencyKey);
      throw err;
    }

    if (this.idempotencyLog.has(idempotencyKey)) {
      // Simulate Brevo duplicate_parameter response
      const err = new Error('duplicate idempotencyKey');
      err.response = {
        status: 400,
        body: { code: 'duplicate_parameter', message: 'duplicate idempotencyKey' },
      };
      throw err;
    }

    this.idempotencyLog.add(idempotencyKey);
    const record = {
      idempotencyKey,
      to,
      recipientName,
      templateType,
      params,
      sentAt: new Date(),
    };
    this.sentEmails.push(record);
    return { success: true, messageId: `mock_msg_${idempotencyKey}` };
  }

  clear() {
    this.sentEmails = [];
    this.simulatedErrors.clear();
    this.idempotencyLog.clear();
  }
}

class OutboxWorker {
  constructor(options = {}) {
    const workerUrl =
      options.databaseUrl ||
      process.env.OUTBOX_WORKER_DATABASE_URL ||
      'postgresql://yuva_outbox_worker:worker_local_pass@127.0.0.1:5432/yuva_test?schema=public';

    this.prisma = new PrismaClient({
      datasources: { db: { url: workerUrl } },
    });
    this.emailAdapter = options.emailAdapter || new MockEmailAdapter();
    this.leaseSeconds = options.leaseSeconds || 120;
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }

  /**
   * Claims up to batchSize jobs using fn_outbox_claim.
   * Every claimed job is stamped with a unique claim_token.
   */
  async claimJobs(batchSize = 1, leaseSeconds = this.leaseSeconds) {
    const jobs = await this.prisma.$queryRaw`
      SELECT id, college_id AS "collegeId", recipient_email AS "recipientEmail",
             recipient_name AS "recipientName", template_type AS "templateType",
             payload, attempts, claim_token AS "claimToken"
      FROM public.fn_outbox_claim(${leaseSeconds}::int, ${batchSize}::int);
    `;
    return jobs;
  }

  /**
   * Processes a single claimed job.
   */
  async processJob(job) {
    try {
      // 1. Decrypt payload
      const decrypted = decryptPayload(job.payload, {
        jobId: job.id,
        collegeId: job.collegeId,
        recipientEmail: job.recipientEmail,
        templateType: job.templateType,
      });

      // 2. Dispatch to email provider with persistent UUID idempotency key
      await this.emailAdapter.sendEmail({
        idempotencyKey: job.id,
        to: job.recipientEmail,
        recipientName: job.recipientName,
        templateType: job.templateType,
        params: decrypted,
      });

      // 3. Mark completed with lease fence check
      const [result] = await this.prisma.$queryRaw`
        SELECT public.fn_outbox_complete(${job.id}::uuid, ${job.claimToken}::uuid) AS completed;
      `;
      return { success: result.completed, job, status: 'DELIVERED' };
    } catch (err) {
      // 4. Handle Brevo idempotency reconciliation
      if (err.response && err.response.body && err.response.body.code === 'duplicate_parameter') {
        const [result] = await this.prisma.$queryRaw`
          SELECT public.fn_outbox_complete(${job.id}::uuid, ${job.claimToken}::uuid) AS completed;
        `;
        return { success: result.completed, job, status: 'DELIVERED', reconciled: true };
      }

      // 5. Fail job with lease fence check
      const errMsg = (err.message || 'DISPATCH_ERROR').substring(0, 255);
      const [result] = await this.prisma.$queryRaw`
        SELECT public.fn_outbox_fail(${job.id}::uuid, ${job.claimToken}::uuid, ${errMsg}::text) AS failed;
      `;
      return { success: false, job, status: 'FAILED_ATTEMPT', error: errMsg, fenceOk: result.failed };
    }
  }

  /**
   * Extends the lease on an actively claimed job.
   */
  async extendLease(jobId, claimToken, seconds = 120) {
    const [result] = await this.prisma.$queryRaw`
      SELECT public.fn_outbox_extend_lease(${jobId}::uuid, ${claimToken}::uuid, ${seconds}::int) AS extended;
    `;
    return result.extended;
  }

  /**
   * Runs the reaper to expire stale, un-sent jobs without active leases.
   */
  async runReaper() {
    const [result] = await this.prisma.$queryRaw`
      SELECT public.fn_outbox_expire() AS count;
    `;
    return result.count;
  }
}

module.exports = {
  OutboxWorker,
  MockEmailAdapter,
};

