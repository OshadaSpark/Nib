import { createHash } from 'node:crypto'
import { readdir } from 'node:fs/promises'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import type { Plugin } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

/**
 * Builds `src/serviceWorker.ts` into `sw.js`, filling in the files it caches: everything in the
 * build, including the public files, with the HTML as `./`, and a version that changes with them.
 */
const serviceWorker = (): Plugin => {
  let publicDir = ''
  return {
    name: 'nib:service-worker',
    apply: 'build',
    // After Vite's own plugins, which emit the HTML.
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir
    },
    buildStart() {
      this.emitFile({ type: 'chunk', id: 'src/serviceWorker.ts', fileName: 'sw.js' })
    },
    async generateBundle(_, bundle) {
      const worker = bundle['sw.js']
      if (worker?.type !== 'chunk') return
      const files = [...Object.keys(bundle), ...(await readdir(publicDir))]
      const precache = files.map((file) => (file === 'index.html' ? './' : file))
      precache.splice(precache.indexOf('sw.js'), 1)
      const version = createHash('sha256').update(precache.sort().join('\n')).digest('hex')
      worker.code = worker.code
        .replace('__PRECACHE__', JSON.stringify(precache))
        .replace('__VERSION__', JSON.stringify(version.slice(0, 16)))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), serviceWorker()],
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
      // These are exercised by the E2E suite instead: `main.ts` only bootstraps the app,
      // `serviceWorker.ts` runs in a worker, and `fileAccess.ts` wraps browser file APIs that jsdom
      // does not implement.
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/main.ts',
        'src/serviceWorker.ts',
        'src/lib/files/fileAccess.ts',
      ],
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
