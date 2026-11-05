/**
 * ESLint Flat Configuration
 *
 * ARCHITECTURAL CHECKLIST FOR withTenant & CONTROLLERS:
 * [1] Controllers must NEVER import the privileged platform database client (platformDb).
 *     Enforced below via no-restricted-imports and no-restricted-modules.
 * [2] withTenant convention: External network I/O (Brevo email sending, Cloudinary uploads,
 *     external HTTP calls) must NEVER be placed inside a withTenant transaction callback.
 *     All external calls must execute strictly BEFORE or AFTER the transaction.
 * [3] All withTenant operations must run exclusively via the provided `tx` handle and finish
 *     promptly to preserve PgBouncer connection pool health.
 */
module.exports = [
  {
    files: ['controllers/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '../config/platformDb',
              message: 'Controllers cannot import the privileged platform_ops client.',
            },
            {
              name: './platformDb',
              message: 'Controllers cannot import the privileged platform_ops client.',
            },
            {
              name: '../config/tenantContext',
              message: 'Controllers must not import tenantContext directly; use config/db instead.',
            },
            {
              name: './tenantContext',
              message: 'Controllers must not import tenantContext directly; use config/db instead.',
            },
            {
              name: '../config/internalClient',
              message: 'Controllers must not import internalClient directly.',
            },
            {
              name: './internalClient',
              message: 'Controllers must not import internalClient directly.',
            },
          ],
          patterns: [
            {
              group: ['*platformDb*'],
              message: 'Controllers cannot import the privileged platform_ops client.',
            },
            {
              group: ['*tenantContext*'],
              message: 'Controllers must not import tenantContext directly; use config/db instead.',
            },
            {
              group: ['*internalClient*'],
              message: 'Controllers must not import internalClient directly.',
            },
          ],
        },
      ],
      'no-restricted-modules': [
        'error',
        {
          paths: [
            {
              name: '../config/platformDb',
              message: 'Controllers cannot import the privileged platform_ops client.',
            },
            {
              name: './platformDb',
              message: 'Controllers cannot import the privileged platform_ops client.',
            },
            {
              name: '../config/tenantContext',
              message: 'Controllers must not import tenantContext directly; use config/db instead.',
            },
            {
              name: './tenantContext',
              message: 'Controllers must not import tenantContext directly; use config/db instead.',
            },
            {
              name: '../config/internalClient',
              message: 'Controllers must not import internalClient directly.',
            },
            {
              name: './internalClient',
              message: 'Controllers must not import internalClient directly.',
            },
          ],
          patterns: ['*platformDb*', '*tenantContext*', '*internalClient*'],
        },
      ],
    },
  },
];
