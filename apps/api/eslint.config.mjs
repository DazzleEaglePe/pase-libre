import { baseConfig } from '@paselibre/config-eslint';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      // Nest uses runtime design metadata from constructor type imports for dependency injection.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
