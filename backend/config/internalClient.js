const { PrismaClient } = require('@prisma/client');

/**
 * Builds a connection URL ensuring pgbouncer=true is present
 * when connecting through PgBouncer or Neon connection poolers,
 * and configures safe connection limits to prevent pool starvation.
 */
function getPooledDatabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  try {
    const url = new URL(rawUrl);
    // If connecting through Neon pooler or port indicates PgBouncer, ensure pgbouncer=true
    if (url.hostname.includes('-pooler') || url.port === '6543') {
      if (!url.searchParams.has('pgbouncer')) {
        url.searchParams.set('pgbouncer', 'true');
      }
    }
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '5');
    }
    return url.toString();
  } catch {
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
