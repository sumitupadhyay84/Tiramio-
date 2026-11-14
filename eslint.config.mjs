import nextPlugin from '@next/eslint-plugin-next';

export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'preview/**']
  },
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      '@next/next': nextPlugin
    },
    rules: {
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@next/next/no-img-element': 'off',
      '@next/next/no-page-custom-font': 'off'
    }
  }
];
