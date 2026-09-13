# Nib

A minimal Markdown and text editor for local files, for macOS: a [Tauri 2](https://v2.tauri.app)
app built on [CodeMirror 6](https://codemirror.net) with [Svelte 5](https://svelte.dev),
[TypeScript](https://www.typescriptlang.org) and [Vite](https://vite.dev). It makes no network
requests.

## Requirements

- macOS 26 or later
- Node.js 24 (see [`.nvmrc`](.nvmrc))
- pnpm (the exact version is pinned in `package.json` → `packageManager`)
- Rust (stable, through [rustup](https://rustup.rs)) and the Xcode Command Line Tools
  (`xcode-select --install`)

```sh
pnpm install
pnpm exec playwright install   # browsers for the E2E tests (first time only)
pnpm tauri dev                 # the app, with the frontend reloading as it changes
```

`pnpm tauri build` builds `src-tauri/target/release/bundle/macos/Nib.app` (about 4 MB) and a disk
image. Copy the app to `/Applications` to install it. `pnpm tauri build --bundles app` builds only
the app.

## Scripts

| Script               | Description                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `pnpm tauri dev`     | Run the app, with the frontend's dev server and HMR                         |
| `pnpm tauri build`   | Build the app and its disk image                                            |
| `pnpm dev`           | Start the frontend's dev server alone, to use in a browser                  |
| `pnpm build`         | Build the frontend into `dist/`, which the app embeds                       |
| `pnpm preview`       | Serve the frontend's build locally                                          |
| `pnpm check`         | Type-check the app (`svelte-check`) and the tooling/E2E code (`tsc`)        |
| `pnpm check:rust`    | Check the Rust code's formatting (`cargo fmt`) and lint it (Clippy)         |
| `pnpm lint`          | Lint with ESLint (fails on any warning); `pnpm lint:fix` applies auto-fixes |
| `pnpm format`        | Format with Prettier; `pnpm format:check` only verifies                     |
| `pnpm test`          | Run unit and component tests once; `pnpm test:watch` for watch mode         |
| `pnpm test:coverage` | Run unit and component tests with a coverage report in `coverage/`          |
| `pnpm test:e2e`      | Build the app and run the Playwright E2E tests against it                   |
| `pnpm test:rust`     | Run the Rust tests                                                          |

## Project structure

```text
src/
  lib/              Reusable components and modules, imported via `$lib/...`
    desktop/        The app's integration with macOS through Tauri, such as the menu bar
    dialog/         The confirmation dialog
    preferences/    The user's preferences and their panel
    editor/         The CodeMirror editor component, its extensions and theme
    files/          Opening and saving local files and folders, and the state of the open files
    ui/             Generic UI pieces, such as the icons
  App.svelte        Root component: the layout, the editor and the file tree
  Header.svelte     The header: file name and its menu (file actions and their shortcuts), toolbar
  main.ts           Entry point
src-tauri/          The Tauri app: its Rust code, configuration, permissions and icons
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
- `extensions.ts` also picks the language by file extension: Markdown for `.md` and `.markdown`
  (rendered live, unless turned off in the preferences), plain text for everything else.
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
  - `links.ts` resolves link targets, including reference links, and opens them. Relative links
    and images go through the `localFiles` facet, which the app provides for the open folder.
    `widgets.ts` draws bullets, checkboxes, entities, images and tables.
  - `formatting.ts` toggles bold, italic and links on the selection (⌘/Ctrl+B, I and K). Inside
    formatted text, the same shortcut removes it.
- `count.ts` counts words and characters, which the header shows (`WordCount.svelte`) for the
  document or the selection. Counts are cached per node of the document's tree, so after an edit only the changed
  nodes are counted again.
- `theme.ts` defines the layout and syntax highlighting. Colours come from the custom properties in
  [`src/app.css`](src/app.css), so light and dark mode need no separate themes.

Every `@codemirror/*` and `@lezer/*` package imported by the app must be a direct dependency, as
pnpm does not expose transitive ones. Keep them on compatible versions: CodeMirror breaks when more
than one copy of `@codemirror/state` is installed (`pnpm why @codemirror/state` should list one).

## Files

Files are known by their absolute path, their location. The Rust side reads and writes them
([`src-tauri/src/files.rs`](src-tauri/src/files.rs)), and the frontend handles them in
[`src/lib/files/`](src/lib/files):

- `files.rs` has the app's file commands: reading a file's bytes and its modified time, writing
  text through a temporary file that then replaces the file (so a failed write leaves it as it was,
  keeping its permissions, and symbolic links as links), listing a directory, creating a file under
  a free name, renaming one (case-only renames included) and moving one to the Trash. They take any
  path, as the page only runs the app's own code.
- `fileSystem.ts` calls those commands, turning their failures into a `FileSystemError` with its
  kind (not found, name taken, other). `fileAccess.ts` adds the system's open, save and folder
  panels, through `tauri-plugin-dialog`.
- `fileTypes.ts` tells Markdown and plain-text files apart by extension (and gives images their
  media type), and `paths.ts` handles paths, absolute or within a folder (joining them, and
  resolving relative links).
- `DropOverlay.svelte` opens files dropped anywhere on the window. The page gets no path for them, so
  saving one asks where to save it.
- `textFile.svelte.ts` holds the open file. It tracks unsaved changes against the last saved content
  and restores the file's line breaks (LF or CRLF) on save, as CodeMirror normalises them to LF, and
  its UTF-8 byte-order mark, if it had one. Files that aren't valid UTF-8 text are refused rather
  than opened with replacement characters, which saving would write back.
- `workspace.svelte.ts` implements New, Open, Open folder, Save and Save as. It reports failures in
  the header, and asks before discarding unsaved changes, in the dialog from
  [`src/lib/dialog/`](src/lib/dialog).
- `folder.svelte.ts` models an open folder: a tree of its Markdown and text files, leaving out dot
  files and `node_modules`, listed lazily as directories expand. `FileTree.svelte` shows it (its
  lists share state and actions through a context, `fileTree.ts`) beside the editor, or over it in a
  narrow window. Switching files keeps each file's unsaved changes, undo history, cursor and scroll
  position; a dot in the tree marks the files with unsaved changes. The tree also creates files
  (named in place, and given `.md` unless they end in `.md`, `.markdown` or `.txt`), renames them,
  keeping unsaved changes, and moves them to the Trash after asking.
- When the window regains focus, the workspace lists the folder again and checks whether the open
  file changed on disk. It reloads a file without unsaved changes, and asks first otherwise. The
  editor takes over the new content without remounting (`difference.ts`), so the cursor and undo
  history stay.

| Shortcut                 | Action                            |
| ------------------------ | --------------------------------- |
| ⌘N                       | New (menu bar)                    |
| ⌘W, ⌘Q                   | Close, Quit (ask about unsaved)   |
| ⌘/Ctrl+O                 | Open                              |
| ⌘/Ctrl+Shift+O           | Open folder                       |
| ⌘/Ctrl+S                 | Save                              |
| ⌘/Ctrl+Shift+S           | Save as                           |
| ⌘/Ctrl+F                 | Find and replace                  |
| Enter, Shift+Enter       | Next and previous match (in Find) |
| ⌘/Ctrl+G, ⌘/Ctrl+Shift+G | Next and previous match           |
| ⌘/Ctrl+B                 | Bold (Markdown)                   |
| ⌘/Ctrl+I                 | Italic (Markdown)                 |
| ⌘/Ctrl+K                 | Link (Markdown)                   |

In Markdown files, ⌘/Ctrl+click on a link opens it: web and email links in their apps, and relative
links (such as `[plan](notes/plan.md)`) in the editor, when the file is in an open folder. Clicking a
checkbox toggles its task, and Alt+Enter does either at the cursor. Images show from data URLs and
from relative paths in an open folder, never from the web: loading them would tell the server when
a document is opened (the app's content security policy blocks them too). Relative paths start from the file's directory, or
from the folder if they start with `/`. Clicking a table shows its source, with the cursor in the
clicked cell.

## Preferences

Settings, in the toolbar's More menu (or ⌘/Ctrl+,), opens the preferences, a modal dialog
([`src/lib/preferences/`](src/lib/preferences)). They apply at once, and are kept in local storage:

- **Theme:** system, light or dark. A picked theme sets `data-theme` on the root element, which
  `app.css` turns into a `color-scheme`, so every `light-dark()` colour follows it.
- **Font** (sans, serif or mono), **size** (14 to 24 px) and **column width** (narrow, medium or
  wide: 60, 72 or 90 characters) of the text. Code keeps its monospace font. The editor sets them
  as custom properties through a theme of their own (`appearanceTheme` in `theme.ts`), so changing
  them makes CodeMirror measure the text again.
- **Render Markdown:** turned off, Markdown files show as written, with their markup highlighted
  rather than hidden (`markdownSourceSupport` in `markdown/language.ts`). The editing commands and
  shortcuts stay.

## Desktop app

[`src-tauri/`](src-tauri) holds the [Tauri 2](https://v2.tauri.app) app, which shows the frontend
in the system's WebKit (WKWebView):

- `tauri.conf.json` configures the window, the bundle and the content security policy, which allows
  no network access: images only from the app, `blob:` and `data:` URLs. The window's title bar is
  overlaid on the page, so the header (or, beside it, the file tree's heading) leaves room for the
  close, minimise and zoom buttons (`--window-controls` in `app.css`) and drags the window
  (`data-tauri-drag-region="deep"`).
- `capabilities/default.json` lists what the page may ask of Tauri.
- `src/lib.rs` starts the app, with its plugins: the system's panels (dialog), opening links
  (opener), the clipboard, and the window's size and position, kept between launches (window
  state). The release profile in `Cargo.toml` optimises for size.
- `src/files.rs` reads and writes files (see Files), `src/opened.rs` keeps the files opened from the
  system until the page asks for them, and `src/window.rs` shows the dot for unsaved changes in the
  window's close button.
- `icons/` holds the app's icons, generated from `icon.svg` with `pnpm tauri icon src-tauri/icons/icon.svg`
  (then delete the icons for other platforms, keeping `icon.icns` and `icon.png`).

The frontend's side of the app is in [`src/lib/desktop/`](src/lib/desktop), each part doing
nothing outside the app (as in tests):

- `menu.ts` builds the menu bar, so its File menu runs the same actions as the header's. The Edit
  menu uses the system's commands, which WKWebView needs for cut, copy, paste and select all. Quit is
  the app's own: it closes the window, which asks first about unsaved changes.
- `window.ts` sets the window's title, the dot for unsaved changes and the theme (for the window's
  buttons and the system's panels), tells when it goes full screen (where the room kept for its
  buttons goes too), and guards closing it: the close button, ⌘W and Quit ask before unsaved
  changes are lost. Quitting from the Dock doesn't: Tauri can't hold that up.
- `openedFiles.ts` opens files opened from the system: `.md`, `.markdown` and `.txt` files are
  associated with the app (`bundle.fileAssociations`), so double-clicking one in Finder, Open With,
  or dropping one on the app's Dock icon opens it, with its location. Without any on launch, the app
  opens again the folder and file that were open last time
  ([`src/lib/files/session.ts`](src/lib/files/session.ts)).

Files dropped on the window go through WebKit, as the window's own file drops (`dragDropEnabled`)
would take every drag, so that text could no longer be dragged within the editor or from other
apps. WebKit gives no path, so a dropped file opens as a copy: saving it asks where.

The header, file tree, status bar and menus aren't selectable text, as in native apps. Links open in
their apps (the browser, Mail) through the opener plugin, and the toolbar's clipboard commands go
through the clipboard plugin, as WebKit would ask the user before each paste.

The frontend is built for the WebKit of macOS 26 only (`build.target` in `vite.config.ts`), so modern
CSS such as `light-dark()` ships as written.

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
Chromium, Firefox and WebKit. The app itself can't be automated, as `tauri-driver` doesn't support
macOS: native parts, such as the menu bar and the pickers, are checked by hand.

Unit and E2E tests share a disk in memory, [`src/lib/files/fakeDisk.ts`](src/lib/files/fakeDisk.ts),
which answers the app's calls to Tauri (the file commands and the pickers) the way the Rust side
does, so the frontend's own code runs down to those calls.

## Git hooks

[Husky](https://typicode.github.io/husky/) installs the hooks on `pnpm install`:

- **pre-commit**: [lint-staged](https://github.com/lint-staged/lint-staged) runs ESLint and Prettier
  on the staged files.
- **commit-msg**: [commitlint](https://commitlint.js.org) enforces
  [Conventional Commits](https://www.conventionalcommits.org) (e.g. `feat: add scoreboard`).
- **pre-push**: type-checks and runs the unit and component tests.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pull requests and on pushes to
`main`:

1. **quality**: format check, lint and type-check
2. **unit**: unit and component tests with coverage
3. **e2e**: Playwright tests in all browsers (the HTML report is uploaded as an artifact)
4. **rust**: on macOS, Rust formatting, Clippy and tests

Dependabot ([`.github/dependabot.yml`](.github/dependabot.yml)) opens weekly update PRs for npm
packages, Rust crates and GitHub Actions.
