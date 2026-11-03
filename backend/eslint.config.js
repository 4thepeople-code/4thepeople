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
          ],
          patterns: [
            {
              group: ['*platformDb*'],
              message: 'Controllers cannot import the privileged platform_ops client.',
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
          ],
          patterns: ['*platformDb*'],
        },
      ],
    },
  },
];
