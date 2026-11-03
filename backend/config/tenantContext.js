const { prisma } = require('./internalClient');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Executes a callback within a tenant-scoped Prisma interactive transaction.
 * Enforces PostgreSQL Row-Level Security (RLS) via transaction-local setting:
 * set_config('app.college_id', collegeId, true)
 *
 * @param {string} collegeId - Valid UUID of the tenant college.
 * @param {Function} callback - Async function (tx) => Promise<T>
 * @returns {Promise<T>} Result of the callback
 */
async function withTenant(collegeId, callback) {
  if (!collegeId || typeof collegeId !== 'string' || !UUID_REGEX.test(collegeId)) {
    const error = new Error('Invalid or missing tenant identifier (must be a valid UUID)');
    error.statusCode = 400;
    throw error;
  }

  if (typeof callback !== 'function') {
    throw new Error('withTenant requires a callback function');
  }

  return await prisma.$transaction(
    async (tx) => {
      // 1. Establish tenant context inside the transaction using parameterized SQL
      await tx.$executeRaw`SELECT set_config('app.college_id', ${collegeId}, true)`;

      // 2. Execute tenant-scoped database operations through tx
      return await callback(tx);
    },
    {
      maxWait: 5000, // 5s max wait to acquire connection from pool
      timeout: 10000, // 10s max execution time
      isolationLevel: 'ReadCommitted',
    }
  );
}

module.exports = { withTenant };
