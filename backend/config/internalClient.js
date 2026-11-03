const { PrismaClient } = require('@prisma/client');

/**
 * Builds a connection URL ensuring pgbouncer=true is present
 * to support PgBouncer transaction pooling mode.
 */
function getPooledDatabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has('pgbouncer')) {
      url.searchParams.set('pgbouncer', 'true');
    }
    return url.toString();
  } catch {
    // If URL parsing fails, append as fallback
    if (!rawUrl.includes('pgbouncer=true')) {
      const sep = rawUrl.includes('?') ? '&' : '?';
      return `${rawUrl}${sep}pgbouncer=true`;
    }
    return rawUrl;
  }
}

const databaseUrl = getPooledDatabaseUrl(process.env.DATABASE_URL);

// Runtime PrismaClient using app_user credentials with connection pooling
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = { prisma };
