# typer

A [Svelte 5](https://svelte.dev) + [TypeScript](https://www.typescriptlang.org) app built with [Vite](https://vite.dev).

## Requirements

- Node.js 24 (see [`.nvmrc`](.nvmrc))
- pnpm (the exact version is pinned in `package.json` → `packageManager`)

```sh
pnpm install
pnpm exec playwright install   # browsers for the E2E tests (first time only)
pnpm dev
```

## Scripts

| Script               | Description                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `pnpm dev`           | Start the dev server with HMR                                               |
| `pnpm build`         | Build for production into `dist/`                                           |
| `pnpm preview`       | Serve the production build locally                                          |
| `pnpm check`         | Type-check the app (`svelte-check`) and the tooling/E2E code (`tsc`)        |
| `pnpm lint`          | Lint with ESLint (fails on any warning); `pnpm lint:fix` applies auto-fixes |
| `pnpm format`        | Format with Prettier; `pnpm format:check` only verifies                     |
| `pnpm test`          | Run unit and component tests once; `pnpm test:watch` for watch mode         |
| `pnpm test:coverage` | Run unit and component tests with a coverage report in `coverage/`          |
| `pnpm test:e2e`      | Build the app and run the Playwright E2E tests against it                   |

## Project structure

```text
src/
  lib/              Reusable components and modules, imported via `$lib/...`
  assets/           Assets imported from code (processed by Vite)
  App.svelte        Root component
  main.ts           Entry point
public/             Static files served as-is from the base path
e2e/                Playwright E2E tests
```

### Import aliases

`$lib/*` maps to `src/lib/*` (the same convention as SvelteKit). Aliases are defined once in the
`paths` of [`tsconfig.app.json`](tsconfig.app.json) and picked up by Vite and Vitest through
`resolve.tsconfigPaths`, so add new aliases there only.

```ts
import Counter from '$lib/Counter.svelte'
```

## TypeScript

- `tsconfig.base.json` holds the shared strictness settings (`strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `erasableSyntaxOnly`, …).
- `tsconfig.app.json` covers the browser code in `src/` (including tests).
- `tsconfig.node.json` covers the Node.js tooling: `*.config.ts`, `svelte.config.js` and `e2e/`.

All Svelte components must use `<script lang="ts">` (enforced by ESLint), and runes mode is enforced
for project code in [`svelte.config.js`](svelte.config.js).

## Testing

Tests are co-located with the code they cover. Vitest runs two projects, selected by file name:

| Project     | Files                     | Environment | Use for                                     |
| ----------- | ------------------------- | ----------- | ------------------------------------------- |
| `unit`      | `src/**/*.test.ts`        | Node.js     | Pure TypeScript logic                       |
| `component` | `src/**/*.svelte.test.ts` | jsdom       | Components (Testing Library) and rune logic |

Component tests use [Testing Library](https://testing-library.com/docs/svelte-testing-library/intro)
with the [`jest-dom`](https://github.com/testing-library/jest-dom) matchers. Every test must contain
at least one assertion (`expect.requireAssertions`).

Coverage fails below 80% for lines, functions and statements. Branch coverage is enforced for `.ts`
modules only, as compiled Svelte templates contain synthetic branches.

E2E tests in `e2e/` run with [Playwright](https://playwright.dev) against the production build in
Chromium, Firefox and WebKit.

## Git hooks

[Husky](https://typicode.github.io/husky/) installs the hooks on `pnpm install`:

- **pre-commit**: [lint-staged](https://github.com/lint-staged/lint-staged) runs ESLint and Prettier
  on the staged files.
- **commit-msg**: [commitlint](https://commitlint.js.org) enforces
  [Conventional Commits](https://www.conventionalcommits.org) (e.g. `feat: add scoreboard`).
- **pre-push**: type-checks and runs the unit and component tests.

## CI/CD

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pull requests and on pushes to
`main`:

1. **quality**: format check, lint and type-check
2. **unit**: unit and component tests with coverage
3. **e2e**: Playwright tests in all browsers (the HTML report is uploaded as an artifact)
4. **deploy** (pushes to `main` only, after all checks pass): builds and deploys to GitHub Pages

To enable deployment, set **Settings → Pages → Build and deployment → Source** to
**GitHub Actions**. Dependabot ([`.github/dependabot.yml`](.github/dependabot.yml)) opens weekly
update PRs for npm packages and GitHub Actions.
