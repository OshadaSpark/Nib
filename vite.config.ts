import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    // Resolve import aliases (e.g. `$lib`) from the `paths` in tsconfig.app.json.
    tsconfigPaths: true,
  },
  // https://vitest.dev/config/
  test: {
    expect: { requireAssertions: true },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,svelte}'],
      // These are exercised by the E2E suite instead: `main.ts` only bootstraps the app, and
      // `fileAccess.ts` wraps browser file APIs that jsdom does not implement.
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/main.ts', 'src/lib/files/fileAccess.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        // Branches are only enforced for TS modules: compiled Svelte templates contain synthetic
        // branches (e.g. `{value}` becomes `value ?? ''`) that tests cannot meaningfully cover.
        'src/**/*.ts': { branches: 80 },
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: [...configDefaults.exclude, 'src/**/*.svelte.test.ts'],
        },
      },
      {
        extends: true,
        plugins: [svelteTesting()],
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['src/**/*.svelte.test.ts'],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
  },
})
