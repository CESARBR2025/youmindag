export default [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Candado anti-inyección: prohíbe interpolar en el primer arg de execSync.
      // Usa execFileSync con array de args (lib/exec.mjs) para todo input de usuario.
      'no-restricted-syntax': ['error', {
        selector: 'CallExpression[callee.name="execSync"] > TemplateLiteral:first-child',
        message: 'No interpoles en execSync — usa execFileSync con array de args (lib/exec.mjs).',
      }],
    },
    files: ['bin/**/*.mjs', 'lib/**/*.mjs'],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
    },
    files: ['template/scripts/**/*.mjs'],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
    },
    files: ['template/.opencode/plugins/*.js'],
  },
]
