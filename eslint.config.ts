import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import playwright from 'eslint-plugin-playwright'
import svelte from 'eslint-plugin-svelte'
import { defineConfig, globalIgnores } from 'eslint/config'
import ts from 'typescript-eslint'
import svelteConfig from './svelte.config.js'

// https://eslint.org/docs/latest/use/configure/configuration-files
export default defineConfig(
  globalIgnores(['dist/', 'coverage/', 'playwright-report/', 'test-results/', 'src-tauri/']),

  js.configs.recommended,
  ts.configs.strictTypeChecked,
  ts.configs.stylisticTypeChecked,
  svelte.configs.recommended,
  // Must come after other configs so it can disable rules that conflict with Prettier.
  prettier,
  svelte.configs.prettier,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
    rules: {
      // TypeScript already reports undefined identifiers, with full knowledge of the environment.
      // https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      'no-undef': 'off',
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
    },
  },

  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        svelteConfig,
      },
    },
    rules: {
      'svelte/block-lang': ['error', { script: 'ts' }],
      // Rune-aware replacement for the core rule (e.g. allows `let` for reassigned `$derived`).
      'prefer-const': 'off',
      'svelte/prefer-const': 'error',
      // Bindable props are declared with a default, `$bindable()`, even when they are required.
      '@typescript-eslint/no-useless-default-assignment': 'off',
    },
  },

  {
    files: ['e2e/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      // Allows skipping tests of browser-specific APIs, e.g. `test.skip(({ browserName }) => …)`.
      'playwright/no-skipped-test': ['warn', { allowConditional: true }],
    },
  },
)
