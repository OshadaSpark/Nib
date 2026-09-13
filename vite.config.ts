import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // Keeps the Rust compiler's output from Tauri in view.
  clearScreen: false,
  // `tauri dev` loads the app from this port (`devUrl` in `src-tauri/tauri.conf.json`).
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  // The app only runs in the WebKit of macOS 26 (WKWebView), so modern syntax and CSS, such as
  // `light-dark()`, need no compiling for older browsers.
  build: { target: 'safari26' },
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
      // `main.ts` only bootstraps the app, which the E2E suite covers.
      exclude: ['src/**/*.test.ts', 'src/main.ts'],
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
