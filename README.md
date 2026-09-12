# typer

A minimal Markdown and text editor for local files, built on [CodeMirror 6](https://codemirror.net)
with [Svelte 5](https://svelte.dev), [TypeScript](https://www.typescriptlang.org) and
[Vite](https://vite.dev).

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
    editor/         The CodeMirror editor component, its extensions and theme
    files/          Opening and saving local files, and the state of the open file
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
import Editor from '$lib/editor/Editor.svelte'
```

## Editor

The editor is [CodeMirror 6](https://codemirror.net), configured in
[`src/lib/editor/`](src/lib/editor):

- `Editor.svelte` mounts an `EditorView` through a Svelte
  [attachment](https://svelte.dev/docs/svelte/@attach) and destroys it on unmount.
- `extensions.ts` is a hand-picked set of extensions for writing prose. It stands in for
  `basicSetup`, which is aimed at code editing (line numbers, fold gutters, …).
- `extensions.ts` also picks the language by file extension: Markdown for `.md` and `.markdown`,
  plain text for everything else.
- `extensions.ts` includes find and replace from `@codemirror/search`, in a panel above the text that
  the theme restyles to match the app.
- `markdown/` holds the Markdown support, which plain-text files don't load:
  - `language.ts` is GitHub Flavored Markdown with its editing keymap. Fenced code blocks are
    parsed in their own language, from the list in `codeLanguages.ts`. Each language loads on first
    use, so none of them add to the main bundle.
  - `livePreview.ts` renders Markdown in place. Markup is hidden, except in the element the
    selection touches, so it can still be edited. `decorations.ts` covers inline elements, lists,
    task lists, quotes, rules and code blocks, for the visible part of the document only.
    `blockWidgets.ts` shows images below their line and renders tables in place of their source.
  - `links.ts` resolves link targets, including reference links; `widgets.ts` draws bullets,
    checkboxes, entities, images and tables.
  - `formatting.ts` toggles bold, italic and links on the selection (⌘/Ctrl+B, I and K). Inside
    formatted text, the same shortcut removes it.
- `theme.ts` defines the layout and syntax highlighting. Colours come from the custom properties in
  [`src/app.css`](src/app.css), so light and dark mode need no separate themes.

Every `@codemirror/*` and `@lezer/*` package imported by the app must be a direct dependency, as
pnpm does not expose transitive ones. Keep them on compatible versions: CodeMirror breaks when more
than one copy of `@codemirror/state` is installed (`pnpm why @codemirror/state` should list one).

## Files

Files are opened and saved in [`src/lib/files/`](src/lib/files):

- `fileAccess.ts` uses the
  [File System Access API](https://developer.mozilla.org/docs/Web/API/File_System_API) where it is
  available (Chromium-based browsers), so saving writes back to the opened file. Other browsers open
  files with a file input and save them as downloads.
- `textFile.svelte.ts` holds the open file. It tracks unsaved changes against the last saved content
  and restores the file's line breaks (LF or CRLF) on save, as CodeMirror normalises them to LF, and
  its UTF-8 byte-order mark, if it had one. Files that aren't valid UTF-8 text are refused rather
  than opened with replacement characters, which saving would write back.
- `workspace.svelte.ts` implements New, Open, Save and Save as. It reports failures in the header, and
  asks before discarding unsaved changes, in the dialog from
  [`src/lib/dialog/`](src/lib/dialog).

| Shortcut                 | Action                            |
| ------------------------ | --------------------------------- |
| ⌘/Ctrl+O                 | Open                              |
| ⌘/Ctrl+S                 | Save                              |
| ⌘/Ctrl+Shift+S           | Save as                           |
| ⌘/Ctrl+F                 | Find and replace                  |
| Enter, Shift+Enter       | Next and previous match (in Find) |
| ⌘/Ctrl+G, ⌘/Ctrl+Shift+G | Next and previous match           |
| ⌘/Ctrl+B                 | Bold (Markdown)                   |
| ⌘/Ctrl+I                 | Italic (Markdown)                 |
| ⌘/Ctrl+K                 | Link (Markdown)                   |

In Markdown files, ⌘/Ctrl+click on a link opens it in a new tab, and clicking a checkbox toggles
its task. Alt+Enter does either at the cursor. Only web and email links open, and only images with
web or data URLs show; relative paths will resolve once folders are supported. Clicking a table
shows its source, with the cursor in the clicked cell.

## TypeScript

- `tsconfig.base.json` holds the shared strictness settings (`strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `erasableSyntaxOnly`, …).
- `tsconfig.app.json` covers the browser code in `src/` (including tests).
- `tsconfig.node.json` covers the Node.js tooling: `*.config.ts` and `svelte.config.js`.
- `tsconfig.e2e.json` covers the E2E tests in `e2e/`, with DOM types for code that runs in the page.

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
