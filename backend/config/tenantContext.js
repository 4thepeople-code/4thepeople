const { prisma } = require('./internalClient');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Explicit transaction timeout and pool acquisition wait settings (in milliseconds)
const TX_MAX_WAIT_MS = 5000; // 5s max wait to acquire a connection from PgBouncer pool
const TX_TIMEOUT_MS = 10000; // 10s max execution time for tenant transaction

/**
 * ============================================================================
 * ARCHITECTURAL CONVENTION & SAFETY RULES FOR withTenant:
 * ============================================================================
 *
 * External network calls, third-party API invocations, and slow asynchronous
 * I/O (e.g. Brevo email sending, Cloudinary image upload/delete, external webhooks)
 * must NEVER be executed inside the `withTenant` callback.
 *
 * WHY THIS IS A CRITICAL ARCHITECTURAL CONVENTION:
 * 1. Connection Pool Starvation:
 *    Transactions hold exclusive leases on PgBouncer connections and database
 *    locks. If an external service hangs or slows down, database connections
 *    are tied up, exhausting the connection pool for all other tenants.
 * 2. Unrecoverable Side-Effects on Rollback:
 *    External calls cannot be rolled back by PostgreSQL. If an external call
 *    (e.g., sending a welcome email or deleting an S3/Cloudinary asset) succeeds
 *    inside `withTenant`, but the subsequent DB statement fails or the transaction
 *    times out (exceeding TX_TIMEOUT_MS), PostgreSQL rolls back the DB changes,
 *    leaving external systems in an inconsistent, orphan state.
 * 3. Timeout Failures:
 *    Transactions have a strict 10s timeout (`TX_TIMEOUT_MS`). Latent external
 *    APIs can easily breach this window and abort the transaction (Prisma P2028).
 *
 * DEVELOPER PRE-COMMIT CHECKLIST FOR ALL withTenant USAGE:
 * [ ] External I/O (Cloudinary, Brevo, external APIs) is placed OUTSIDE the transaction.
 * [ ] Expensive CPU work (e.g. bcrypt.hash, JWT generation) is completed before entering withTenant.
 * [ ] Only database queries and mutations using the provided `tx` argument are executed inside.
 * [ ] The callback executes quickly (typical latency < 100ms) to ensure high concurrency.
 * ============================================================================
 *
 * Executes a callback within a tenant-scoped Prisma interactive transaction.
 * Enforces PostgreSQL Row-Level Security (RLS) via transaction-local setting:
 * set_config('app.college_id', collegeId, true)
 *
 * @param {string} collegeId - Valid UUID of the tenant college.
 * @param {Function} callback - Async function (tx) => Promise<T>
 * @param {Object} [options] - Optional transaction overrides (e.g. for testing)
 * @returns {Promise<T>} Result of the callback
 */
async function withTenant(collegeId, callback, options = {}) {
  if (!collegeId || typeof collegeId !== 'string' || !UUID_REGEX.test(collegeId)) {
    const error = new Error('Invalid or missing tenant identifier (must be a valid UUID)');
    error.statusCode = 400;
    throw error;
  }

  if (typeof callback !== 'function') {
    throw new Error('withTenant requires a callback function');
  }

  const maxWait = options.maxWait !== undefined ? options.maxWait : TX_MAX_WAIT_MS;
  const timeout = options.timeout !== undefined ? options.timeout : TX_TIMEOUT_MS;

  return await prisma.$transaction(
    async (tx) => {
      // 1. Establish tenant context inside the transaction using parameterized SQL
      await tx.$executeRaw`SELECT set_config('app.college_id', ${collegeId}, true)`;

      // 2. Execute tenant-scoped database operations through tx
      return await callback(tx);
    },
    {
      maxWait,
      timeout,
      isolationLevel: 'ReadCommitted',
    }
  );
}

module.exports = {
  withTenant,
  TX_MAX_WAIT_MS,
  TX_TIMEOUT_MS,
};
