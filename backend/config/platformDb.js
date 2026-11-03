const { PrismaClient } = require('@prisma/client');

/**
 * Privileged Platform Administration Database Client.
 * Connects using the platform_ops role (BYPASSRLS).
 *
 * RESTRICTED ACCESS:
 * This module is reserved exclusively for platform super-admin routes (/api/platform/*).
 * Normal college controllers must NEVER import or use this client.
 * Enforced via ESLint rule: no-restricted-imports.
 */
const platformDatabaseUrl = process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL;

const platformPrisma = new PrismaClient({
  datasources: {
    db: {
      url: platformDatabaseUrl,
    },
  },
  log: ['error'],
});

module.exports = { platformPrisma };
