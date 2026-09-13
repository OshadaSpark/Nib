# CLAUDE.md

Guidance for Claude Code in this repository. [`README.md`](README.md) covers setup, scripts.

## The product

A minimal Markdown and text editor for local files: a macOS app built with Tauri 2, showing the
Svelte frontend in the system's WebKit (WKWebView). Fast, small and private: no network requests.
Markdown renders live in place, like Obsidian or Notion, never in a split preview. Files without a
Markdown extension are edited as plain text; the file extension is the only difference.
`ROADMAP.md` (local, kept out of Git) tracks the move from the web app, phase by phase: tick items
off and add a session note as work lands.

## How the owner wants work done

- **Quality bar:** no dead code, no bloat, no anti-patterns, no misconfiguration. TypeScript fully
  typed, with zero errors and zero warnings in `pnpm check` and `pnpm lint`. Comment where it adds
  clarity (the why), not to narrate. Match the density and style of the surrounding code.
- **UI:** simple, minimal and clean. Modern CSS: custom properties, `light-dark()`, nesting,
  logical properties. Check new UI visually in light mode and dark mode, in the app itself
  (`pnpm tauri dev`), as WKWebView lays some things out differently from Playwright's WebKit, down
  to the window's minimum width (480px) before calling it done.
- **Git:** one branch per feature (`feat/…`, `fix/…`, `chore/…`) off `main`; Conventional Commits
  (enforced by commitlint). Commit, push, open PRs and merge only when asked. Merge with
  `gh pr merge <n> --rebase --delete-branch`, then pull `main` and `git fetch --prune`.
- **PRs:** open with `gh`. The description has a Summary (what changed and why, including trade-offs
  and measured numbers such as bundle size) and a Testing section (what ran and passed). Watch CI
  with `gh pr checks <n> --watch`. After merging, confirm the CI run on `main` passed.

## Commands

```sh
pnpm check           # svelte-check (app) + tsc (node tooling, e2e)
pnpm check:rust      # cargo fmt --check + Clippy (needs dist/, so build first)
pnpm lint            # ESLint, fails on any warning
pnpm format          # Prettier
pnpm test:coverage   # Vitest with coverage thresholds
pnpm test:rust       # cargo test
pnpm test:e2e        # builds, then Playwright in Chromium, Firefox and WebKit
pnpm build           # watch the bundle size in the output
pnpm tauri dev       # the app, with HMR; pnpm tauri build for Nib.app
```

Before calling work finished, run all of these, the same as CI. The pre-push hook only runs `check`
and `test`.

## Architecture

```text
src/
  App.svelte                  Layout grid: the file tree aside (full height, a drawer with a scrim
                              on narrow screens), Header, the editor keyed by the open file (with
                              its snapshot, the localFiles facet for the folder and a listener for
                              whether the search panel is open), the error toast (dismissible) and
                              the footer with StatusBar (if any item is on). Header and footer fade
                              while writing (if on), until the pointer moves. Also the focus check
                              for disk changes, beforeunload guard, document title, drop overlay,
                              dialog
  Header.svelte               One row: files toggle, file name (truncated) with the file menu
                              beside it (a popover: New/Open/Open folder/Save/Save as, shortcuts
                              shown per platform), then the Toolbar, given the header's measured
                              width. Owns the SettingsDialog (⌘/Ctrl+,, or the toolbar's More menu)
                              and sets the menu bar (setAppMenu) with its actions. Starts after
                              --window-controls (the traffic lights), unless the file tree is
                              beside it; drags the window (data-tauri-drag-region="deep")
  StatusBar.svelte            Saved/Edited, cursor position, lines, words and characters (of the
                              selection too), file type, line endings, encoding: each if on
  main.ts                     Mounts App
  app.css                     Design tokens (--color-*, --font-*, --shadow-raised, --bar-height,
                              --window-controls), base button style, .icon-button, .popover
                              (anchored under its header
                              button via position-anchor), .menu (a popover's commands, with icon
                              and shortcut, in sections), dialog (raised, with backdrop),
                              .truncate, .visually-hidden
  lib/desktop/
    menu.ts                   menuItems(commands) (the app, File, Edit and Window menus; Edit is the
                              system's items) and setAppMenu, a no-op outside Tauri (tests, E2E)
  lib/ui/
    Icon.svelte               Outline icons by name (path data on a 16 × 16 grid), sized by prop
    shortcut.ts               ⌘/Ctrl shortcuts in the platform's notation, and for aria-keyshortcuts
  lib/preferences/
    preferences.svelte.ts     Preferences: theme, font, size, width, livePreview, lineNumbers,
                              spellcheck, toolbar, fadeWhileWriting, status (items on or off), and
                              the derived editor appearance; validated load from and save to
                              localStorage (App saves in an effect)
    SettingsDialog.svelte     Modal <dialog> (bindable open): Appearance, Editor and Status bar
                              sections, each setting two cells of a grid
    Segments.svelte           Generic segmented radio group with a bindable value
    Stepper.svelte            Generic −/+ number stepper with a bindable value, within bounds
    Switch.svelte             Checkbox with role="switch" and its label, bindable
  lib/dialog/
    confirmation.svelte.ts    Confirmation: the pending Question; `ask` (bound) is the Confirm
                              function Workspace takes
    ConfirmDialog.svelte      Modal <dialog> for the pending question; Cancel is focused first
  lib/editor/
    Editor.svelte             Mounts the EditorView through a Svelte attachment. Props: doc (a new
                              one is applied as a diff, keeping selection and history), language
                              (Compartment), appearance (Compartment), extensions (fixed at
                              mount), snapshot/onleave (state
                              handed over on unmount and restored), onchange(doc), onselect,
                              onview (the view, then null on unmount)
    snapshot.ts               EditorSnapshot: state JSON (with history) and scroll position
    extensions.ts             editorExtensions (base set, find and replace),
                              appearanceExtensions(Appearance) (theme, line numbers, spellcheck)
                              and languageFor(fileName, livePreview)
    theme.ts                  EditorView.theme (layout, line number gutter, rendered Markdown,
                              search panel), reading --editor-font/-size/-width set by
                              appearanceTheme(Appearance); prose HighlightStyle, and tok-* classes
                              for code tokens (code blocks only)
    count.ts                  countText (cached per Text tree node) and countString
    Toolbar.svelte            In the header: formatting groups (Markdown files, if on), undo/redo,
                              the find toggle and the More menu (cut/copy/paste/select all,
                              Settings). Picks the widest of five layout steps that fits the
                              header's width (less a reserve for the name, widths in rem kept in
                              step with its styles), folding groups into popover menus; roving
                              tabindex with the arrow keys
    clipboard.ts              cut, copy and paste Commands through the Clipboard API
    difference.ts             The single change between two documents (common start and end kept)
  lib/editor/markdown/        Markdown support; plain-text files load none of it
    language.ts               markdownSupport: markdownLanguage's parser + parseCode (nested code
                              languages), keymap (incl. formatting), pasteURLAsLink, livePreview;
                              markdownSourceSupport: the same without livePreview
    formatting.ts             StateCommands: toggleBold/Italic/Strikethrough/InlineCode/Link,
                              toggleHeading(level), toggleQuote, toggleBullet/Ordered/TaskList,
                              insertCodeBlock/Rule/Table; the keymap for ⌘/Ctrl+B, I and K
    codeLanguages.ts          Curated LanguageDescriptions for code blocks, each lazy-loaded
    livePreview.ts            The live preview extension: view plugin, blockWidgets field, Alt+Enter
                              and mouse handling (⌘/Ctrl+click links, checkboxes)
    tasks.ts                  isChecked (a TaskMarker) and toggleTask
    decorations.ts            previewDecorations(state, ranges): inline markup, bullets, checkboxes,
                              quote bars, rules, code block lines; hidden unless the selection
                              touches the element. Visible ranges only
    blockWidgets.ts           StateField of block decorations: images below their line, tables
                              replacing their source (unless touched). Scan cached per tree
    links.ts                  destinationOf/linkTarget/linkAt (incl. reference links); localFiles
                              facet (relative links and images); openLink(state, url),
                              isShowableImage(state, src)
    widgets.ts                WidgetTypes (entity, bullet, checkbox, image, table) and the table
                              model types
    testState.ts              markdownState(input) for tests; `‸` marks the cursor
  lib/files/
    fileAccess.ts             openFile/readFile/lastModified/droppedFile/saveFile: File System
                              Access API, falling back to a file input and downloads. Returns bytes
    file-system-access.d.ts   Picker and getAsFileSystemHandle types, optional so callers must
                              feature-detect
    textFile.svelte.ts        TextFile: name, handle, content, loaded, dirty, modified; reload,
                              line-break and BOM round-trip. decodeText (strict UTF-8, keeps BOM)
    workspace.svelte.ts       Workspace(confirm): the open file and folder, opened files by path
                              (SvelteMap, keeping edits), newFile/open/openDropped/openFolder/
                              openPath/save/saveAs/createFile/renameFile/deleteFile/openLink/
                              imageURL/checkDisk, error state, busy guard
    folder.svelte.ts          Folder: lazily listed tree (DirectoryNode/FileNode), refresh, reveal,
                              file(path), pathOf, create/rename/remove, imageURL
    paths.ts                  Folder paths: join, nameOf, parentOf, isValidName, resolvePath
    fileTypes.ts              Markdown and text extensions: isMarkdownName, isEditableName,
                              withExtension (the only place the extensions are listed)
    FileTree.svelte           The folder's tree: heading with New file, create/rename state, which
                              it shares with its lists through the fileTree.ts context
    fileTree.ts               FileTree context: tree state and actions (createContext)
    FileTreeList.svelte       One directory's entries, recursive; rows with Rename and Delete
    NameField.svelte          Inline name input: Enter submits, Escape cancels, blur submits
    objectURLs.ts             Object URLs per key, remade when the file changes
    writeFile.ts              Atomic write through createWritable (abort on failure)
    DropOverlay.svelte        Window-level drag and drop of files, with an overlay while dragging
    testFiles.ts              handle(name), opened(name, text, …), fakeFolder(name, tree) (in-memory
                              directory handles) and fakeText(folder, path), for tests
src-tauri/
  tauri.conf.json             Window (overlay title bar, traffic light position, HTML drag and drop
                              kept), CSP without network access, bundle (app and dmg, macOS 26)
  capabilities/default.json   The page's permissions: core defaults, dragging and zooming the window
  src/lib.rs, src/main.rs     Starts the app
  Cargo.toml                  Clippy pedantic, unsafe forbidden, release profile for size
  icons/                      icon.svg (on the macOS grid) and the icon.icns/icon.png made from it
```

Data flow: `Workspace.file` is a `TextFile`. `App` renders `{#key workspace.file}<Editor …>`, so
opening or creating a file remounts the editor with fresh state (including undo history), or with the
state from the file's `snapshot` if it was shown before (files in a folder). Saving
does not remount, and neither does reloading from disk: `TextFile.reload` replaces `loaded`, which
the editor applies as a diff. The editor owns the document; it reports each change through
`onchange` into `file.content`, and `dirty` is `!content.eq(saved)`.

## Pitfalls already hit

- **`markdown()` from `@codemirror/lang-markdown`** always bundles the HTML, CSS and JavaScript
  languages (about +185 kB). Markdown support is composed from `markdownLanguage`,
  `markdownKeymap` and `pasteURLAsLink` in `markdown/language.ts` instead. Keep it that way.
- **Never use `@codemirror/lang-html`, `lang-css` or `lang-javascript`, not even lazily:**
  `lang-markdown` imports `lang-html` statically, which imports the other two, so once anything uses
  them Rolldown puts them in the main bundle (+175 kB) despite the dynamic `import()`. The same
  rules out `@codemirror/language-data` and `lang-php`. Code blocks use the legacy modes for web
  languages instead. After touching `codeLanguages.ts`, check the build: the entry must stay a
  single chunk without `htmlLanguage` in it.
- **One copy of `@codemirror/state`:** duplicates break CodeMirror's `instanceof` checks. After
  adding CodeMirror packages, `pnpm why @codemirror/state` must show a single version. Every
  `@codemirror/*` and `@lezer/*` package imported must be a direct dependency.
- **Text column padding goes on `.cm-line`, not `.cm-content`:** `drawSelection` measures selection
  edges from the content box plus the line's padding, so padding on the content makes selections
  run to the window edge.
- **Theme specificity:** the base theme's `&light`/`&dark` scope is a single class, so theme rules
  with the same selector win on source order. Use the selectors from the CodeMirror docs (for
  example the full `.cm-selectionBackground` chain).
- **Extension identity:** Compartment checks compare by identity, so return shared constants from
  functions like `languageFor`, never fresh `[]`.
- **Picker receivers:** `window.showOpenFilePicker` and `window.showSaveFilePicker` throw "Illegal
  invocation" if called unbound. Use `window.showOpenFilePicker?.bind(window)`, not destructuring.
  Lint does not catch this, because they are typed as function properties.
- **Live preview decorations:** view plugins may not replace line breaks, so `hide()` in
  `decorations.ts` skips ranges that span one. Block widgets and multi-line replacements (images,
  tables) must come from a state field (`blockWidgets.ts`). `RangeSet.between` does not visit ranges
  in document order across layers; use `iter()` when order matters (as the tests do).
- **Nested code trees:** `parseCode` mounts code blocks' trees as overlays. `Tree.iterate` and
  `resolve` don't enter them; `resolveInner` does. Use `resolve` when looking for Markdown nodes.
- **Line backgrounds and bars** (code blocks, quotes, rules) are positioned pseudo-elements on
  `.cm-line`, inset by `--line-inset-start`/`-end` from `theme.ts`: custom properties holding
  `100%` and `ch`, which resolve where they are used, the same there as in the line's padding.
  With line numbers (`.cm-numbered`) the gutter takes the start inset, so the text doesn't move. Code backgrounds sit at `z-index: -10`, below CodeMirror's selection layers (small
  negative z-indexes). Don't change a line's `font-size`: the insets use `ch`, which would shift
  the text column; change `line-height` instead (as `.cm-codeFence` does).
- **Undefined references:** the parser makes a `Link` node of any `[text]`, so reference-style links
  only render when their label is defined in the document.
- **Line breaks:** CodeMirror normalises line endings to `\n`. `TextFile` records the file's
  (`\r\n` or `\n`) and `serialize()` restores it. Don't write `content.toString()` to disk.
- **Svelte and CodeMirror:** create the view untracked (`untrack`) inside the attachment, so prop
  changes don't recreate it. `$effect` inside the attachment reacts to later prop changes.
  CodeMirror `Text` and `EditorView` are class instances: store them with `$state.raw`.
- **File handles in IndexedDB crash off the record:** Chromium's renderer crashes when it reads a
  stored `FileSystemHandle` back from IndexedDB in an off-the-record profile, which Playwright's
  default contexts are (a persistent context works). Possibly Incognito too: check by hand before
  storing handles.
- **Stale E2E builds:** Playwright reuses a server already on port 4173 and then skips `pnpm build`.
  Stop any preview server you started before running `pnpm test:e2e`.
- **`<dialog>` in jsdom:** jsdom lacks `showModal`/`close`; `vitest.setup.ts` polyfills them. Svelte
  only accepts `autofocus` on a dialog's direct children.
- **Svelte `fireEvent` is async**, and user-event leaves `keyCode` at 0, which CodeMirror's search
  panel checks for Enter: cover that in E2E.
- **jsdom gaps, stubbed in `vitest.setup.ts`:** `matchMedia` (CodeMirror also calls `addListener`
  on it), `ResizeObserver` (Svelte's `bind:clientWidth` uses it) and
  `Range.getClientRects`/`getBoundingClientRect`, besides `<dialog>`. Elements measure 0 wide, so
  the toolbar shows its narrowest layout: tests that need another spy on `clientWidth` (`layOut` in
  `App.svelte.test.ts`).
- **`IconName` is error-typed to ESLint** (it comes from `Icon.svelte`'s module script): copying an
  `icon` from one object into a new one trips `no-unsafe-assignment`. Pass the object itself (as the
  toolbar's groups, which are menus).
- **Dialog `close` comes a task later:** after Escape, a dialog is hidden before its `close` event
  sets `open` to false, so E2E tests wait for it to leave the DOM before opening it again.
- **`svelte/prefer-svelte-reactivity`** flags any `new Map`/`Set` in `.svelte.ts` files, even local
  ones: keep plain caches in `.ts` modules (as `objectURLs.ts`).
- **Styling child components:** scoped styles don't reach into a child component (such as `Icon`),
  so a parent styles its markup through `:global()` under a scoped selector, as `FileTreeList` does
  for the chevron's rotation.
- **CSS nesting order:** declarations after a nested rule (such as `@supports`) apply after it and
  override it. Put declarations first, then nested rules.
- **`{@render}` trips `no-confusing-void-expression`:** recursive markup uses a component that imports
  itself (`FileTreeList.svelte`) instead of a snippet.
- **Background work and the busy guard:** `checkDisk` runs on focus and after switching files; it must
  not hold `#busy` while it reads, or it drops the user's actions (it counts started actions and
  gives way instead). TypeScript narrows private fields across `await`, so recheck state through a
  counter, not `this.#busy`.
- **Renaming files on disk:** `FileSystemFileHandle.move()` is behind a flag in Chrome for files
  outside the origin private file system, so `Folder.rename` falls back to copy and delete, refusing
  when the copy is the original (case-insensitive file systems).
- **Vite dev server after new imports** (such as `svelte/reactivity`) can serve outdated pre-bundled
  dependencies (504 "Outdated Optimize Dep"): restart it.
- **Icons:** `pnpm tauri icon src-tauri/icons/icon.svg` makes every platform's icons; keep only
  `icon.icns` and `icon.png`. The SVG draws the shape at 824 of 1024 points, the macOS icon grid.
- **Build target:** `build.target` is `safari26`, the WKWebView of macOS 26, so `light-dark()` and
  the rest ship uncompiled. E2E still runs in Chromium and Firefox, which support them too.
- **Grid on a modal `<dialog>` in WKWebView:** the system WebKit stretches a dialog that is a grid
  to the window's height (between its `inset: 0`), and its rows with it. Playwright's WebKit
  doesn't. Lay dialogs out with flex or blocks (as `ConfirmDialog`).
- **Traffic lights:** `trafficLightPosition.y` isn't the buttons' top: their centre sits at about
  `y - 2`, so `y: 26` centres them in the 3rem header. `--window-controls` (5rem) is the room they
  take, on the header or, when the file tree is beside it, on the tree's heading.
- **Drag regions:** `data-tauri-drag-region` alone only drags from the element itself; `"deep"`
  drags from its descendants too, except clickable ones (buttons, links, `tabindex`). Dragging and
  double-click zoom need `core:window:allow-start-dragging` and `allow-internal-toggle-maximize`.
- **CSP and styles:** Tauri adds nonces to the CSP, which make browsers ignore `'unsafe-inline'`,
  and CodeMirror and Svelte set inline styles. `dangerousDisableAssetCspModification: ["style-src"]`
  keeps `'unsafe-inline'` working for styles only. `devCsp` also allows Vite's HMR websocket.
- **`document.title` doesn't reach the window title** in Tauri (seen in the Window menu and
  Mission Control): set it through the window API.
- **Menu bar shortcuts:** the File menu's accelerators and `Header`'s keydown handler cover the same
  keys (⌘O, ⌘S, ⇧⌘S, ⌘,); either path runs the same action, and the busy guard stops overlaps. ⌘N
  and ⇧⌘O are the menu bar's only (browsers keep ⌘N for a new window).
- **Rust needs `dist/`:** `generate_context!` embeds the frontend's build, so `cargo clippy`,
  `cargo test` and `cargo build` fail without `pnpm build` first (CI builds before them).
- **Automating the app:** System Events can drive it (`osascript`: keystrokes, menu items) and
  `screencapture -l <window id>` capture it; mixing fast `keystroke` text with `key code` presses
  reorders them, so paste longer text through `pbcopy` and ⌘V instead.
- **CodeMirror only re-measures text for theme changes:** changing fonts or sizes from outside (CSS
  variables on an ancestor) leaves line heights and the cursor stale. Put such values in a theme in
  a compartment (as `appearanceTheme`).
- **`$bindable()` and `no-useless-default-assignment`:** the rule is off for Svelte files, as it
  flags the required rune default.
- **Native popovers in jsdom** can't open, so their contents are hidden: query with `hidden: true`.
  Hidden elements also lose their accessible name, so query the menu's buttons directly rather
  than within the popover by its label.
- **commitlint footers:** a body line starting `word:` is parsed as a footer; reword it.
- **ESLint in `.svelte` templates** can't see the prop types of imported components, so inline
  callbacks get `any` parameters. Declare typed handlers in `<script>`.

## Testing conventions

- `*.test.ts` runs in Node (pure logic); `*.svelte.test.ts` runs in jsdom (components and rune
  classes). Every test needs an assertion. Tests sit next to the code they cover.
- jsdom can't type into contenteditable. To simulate typing, get the view with
  `EditorView.findFromDOM(textbox)` and `dispatch` changes. The editor's accessible name is
  "Document".
- `vi.mock` automocks keep call history between tests: `vi.resetAllMocks()` and
  `vi.restoreAllMocks()` in `afterEach`.
- Coverage excludes `main.ts` and `fileAccess.ts` (browser APIs jsdom lacks). Both are covered by
  E2E instead.
- Tauri APIs are mocked in unit tests (`vi.mock('@tauri-apps/api/core')` for `isTauri`, `vi.spyOn`
  on classes such as `Menu`, since `vi.mocked(Menu.new)` trips `unbound-method`). The app itself
  can't be driven by Playwright (`tauri-driver` doesn't support macOS): check native parts by hand.
- E2E code that runs in the page needs DOM types: `e2e/` has its own `tsconfig.e2e.json`.
  Chromium-only tests use `test.skip(({ browserName }) => …)`, which the lint config allows. The
  File System Access E2E tests stub the native pickers with handles from the Origin Private File
  System (`navigator.storage.getDirectory()`), so reads and writes still go through the real API.
- Markdown unit tests build states with `markdownState(input)` from `markdown/testState.ts`, where
  `‸` marks the cursor (two mark a selection). Not `|`, which tables use.
- The placeholder text sits inside the content DOM, so an empty editor's text is not `''`.
- The native pickers and the save permission prompt can't be automated: ask the owner to check them
  by hand in Chrome.

## CI and builds

CI (`.github/workflows/ci.yml`) runs the quality, unit, E2E and Rust (macOS) jobs on PRs and on
pushes to `main`. There is no deploy: `pnpm tauri build` makes `Nib.app` locally, which the owner
copies to `/Applications`.
