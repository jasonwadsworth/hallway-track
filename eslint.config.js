import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
  // Global ignores
  {
    ignores: [
      'dist/**',
      'cdk.out/**',
      'node_modules/**',
      'frontend/dist/**',
      'frontend/node_modules/**',
      '**/*.js', // Only lint TypeScript files
    ],
  },
  // Base JavaScript config
  js.configs.recommended,
  // TypeScript configs
  ...tseslint.configs.recommended,
  // Configuration for TypeScript files in infrastructure (backend)
  {
    files: ['infrastructure/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    rules: {
      // Make unused variables a warning instead of error
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          args: 'none', // Don't check function parameters
        },
      ],
      'no-unused-vars': 'off', // Turn off base rule as it conflicts with @typescript-eslint version
      // Allow console.log in backend code
      'no-console': 'off',
      // Allow any type occasionally in infrastructure code
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // Configuration for React/TypeScript files in frontend
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Make unused variables a warning instead of error
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          args: 'none', // Don't check function parameters in type definitions
        },
      ],
      'no-unused-vars': 'off', // Turn off base rule as it conflicts with @typescript-eslint version
      // React hooks rules
      ...reactHooks.configs.recommended.rules,
      // React refresh rules
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
];