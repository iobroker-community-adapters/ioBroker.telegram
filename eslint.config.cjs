const globals = require('globals');
const js = require('@eslint/js');

const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = [{
    ignores: ['.dev-server/**', 'admin/custom/**', 'admin/rules/**', 'src/**', 'src-admin/**', 'admin/blockly.js'],
}, ...compat.extends('eslint:recommended'), {
    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.mocha,
        },

        ecmaVersion: 2022,
        sourceType: 'commonjs',

        parserOptions: {
            ecmaFeatures: {
                jsx: true,
            },
        },
    },

    rules: {
        indent: ['error', 4, {
            SwitchCase: 1,
        }],

        'no-console': 'off',
        'no-var': 'error',
        'no-trailing-spaces': 'error',
        'prefer-const': 'error',

        quotes: ['error', 'single', {
            avoidEscape: true,
            allowTemplateLiterals: true,
        }],

        semi: ['error', 'always'],
    },
}];