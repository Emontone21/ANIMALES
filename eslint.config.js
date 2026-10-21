// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: [
      'dist/*',
      'e2e/.dist/*',
      'node_modules/*',
      'ios/*',
      'android/*',
      'supabase/*',
      'services/*',
      'scripts/evaluar-ia.ts',
    ],
  },
]);
