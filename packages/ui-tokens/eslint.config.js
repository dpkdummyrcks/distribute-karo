import base from '@dk/config/eslint';

export default [
  ...base,
  { languageOptions: { globals: { process: 'readonly', console: 'readonly' } } },
  { files: ['build.mjs'], rules: { 'no-console': 'off' } },
];
