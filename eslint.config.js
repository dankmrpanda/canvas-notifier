import globals from 'globals';
import pluginJs from '@eslint/js';

/** @type {import('eslint').Linter.Config[]} */
export default [
    pluginJs.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.es2021
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': 'off',
            'prefer-const': 'warn',
            'no-var': 'error',
            'eqeqeq': ['warn', 'always'],
            'curly': ['warn', 'all'],
            'semi': ['warn', 'always'],
            'quotes': ['warn', 'single', { avoidEscape: true }]
        }
    },
    {
        ignores: ['node_modules/', 'courses/']
    }
];
