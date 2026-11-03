const { withTenant } = require('./tenantContext');

/**
 * Main application database module.
 * In accordance with Phase 1 multi-tenant architecture, this module
 * exports ONLY withTenant(). Controllers must not execute un-scoped
 * global Prisma queries.
 */
module.exports = { withTenant };
