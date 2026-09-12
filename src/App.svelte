<script lang="ts">
  import type { EditorSelection, Text } from '@codemirror/state'
  import { onMount } from 'svelte'
  import { MediaQuery } from 'svelte/reactivity'
  import ConfirmDialog from '$lib/dialog/ConfirmDialog.svelte'
  import { Confirmation } from '$lib/dialog/confirmation.svelte'
  import { countString, countText, type Counts } from '$lib/editor/count'
  import { languageFor } from '$lib/editor/extensions'
  import { localFiles } from '$lib/editor/markdown/links'
  import Editor from '$lib/editor/Editor.svelte'
  import type { Appearance } from '$lib/editor/theme'
  import type { EditorSnapshot } from '$lib/editor/snapshot'
  import DropOverlay from '$lib/files/DropOverlay.svelte'
  import { canOpenFolders, readFile, type OpenedFile } from '$lib/files/fileAccess'
  import FileTree from '$lib/files/FileTree.svelte'
  import type { TextFile } from '$lib/files/textFile.svelte'
  import { Workspace } from '$lib/files/workspace.svelte'
  import { Preferences, type Width } from '$lib/preferences/preferences.svelte'
  import PreferencesPanel from '$lib/preferences/PreferencesPanel.svelte'

  const confirmation = new Confirmation()
  const workspace = new Workspace(confirmation.ask)

  // Files opened from the system with the installed app (File Handling API, Chromium). Each launch
  // gets a window of its own, so this only has the file to open.
  onMount(() => {
    window.launchQueue?.setConsumer(({ files: [handle] }) => {
      if (handle instanceof FileSystemFileHandle) openWith(() => readFile(handle))
    })
  })

  const preferences = new Preferences()

  $effect(() => {
    preferences.save()
  })

  // The page follows the system's colour scheme unless the user picked one (see `app.css`).
  $effect(() => {
    document.documentElement.dataset.theme = preferences.theme
  })

  /** The text column's width for each preference, in `ch` of the text's font. */
  const columnWidths: Record<Width, string> = { narrow: '60ch', medium: '72ch', wide: '90ch' }

  const appearance: Appearance = $derived({
    font: `var(--font-${preferences.font})`,
    size: `${String(preferences.size / 16)}rem`,
    width: columnWidths[preferences.width],
  })

  const systemDark = new MediaQuery('(prefers-color-scheme: dark)')
  /** Colours the browser's or installed app's title bar like the page. */
  const themeColor = $derived(
    preferences.theme === 'dark' || (preferences.theme === 'system' && systemDark.current)
      ? '#19191b'
      : '#fdfdfc',
  )

  const title = $derived(`${workspace.file.dirty ? '• ' : ''}${workspace.file.name} — typer`)

  const onchange = (doc: Text): void => {
    workspace.file.content = doc
  }

  /** Relative links and images lead to the open folder's files. */
  const folderFiles = localFiles.of({
    open: (target) => workspace.openLink(target),
    imageURL: (src) => workspace.imageURL(src),
  })

  /** Keeps the editor's state for `file` while another file is shown. */
  const keepSnapshot =
    (file: TextFile) =>
    (snapshot: EditorSnapshot): void => {
      file.snapshot = snapshot
    }

  /** Whether the file tree shows, once a folder is open. */
  let filesShown = $state(true)
  /** Below this width, the file tree covers the editor rather than sitting beside it. */
  const narrow = '(width < 48rem)'

  /** Counts for the selected text, if any. */
  let selected = $state.raw<Counts | null>(null)

  // Called after `onchange`, so the content matches the selection.
  const onselect = ({ main }: EditorSelection): void => {
    selected = main.empty
      ? null
      : countString(workspace.file.content.sliceString(main.from, main.to))
  }

  const numbers = new Intl.NumberFormat()
  /** "1,234 words", or "12 of 1,234 words" for a selection. */
  const describe = (total: number, part: number | undefined, unit: string): string => {
    const amount = `${numbers.format(total)} ${unit}${total === 1 ? '' : 's'}`
    return part === undefined ? amount : `${numbers.format(part)} of ${amount}`
  }

  const counts = $derived(countText(workspace.file.content))
  const words = $derived(describe(counts.words, selected?.words, 'word'))
  const characters = $derived(describe(counts.characters, selected?.characters, 'character'))

  // Actions handle their own failures, so their promises need not be awaited.
  const newFile = (): void => {
    void workspace.newFile()
  }
  const open = (): void => {
    void workspace.open()
  }
  const openFolder = (): void => {
    filesShown = true
    void workspace.openFolder()
  }
  const openPath = (path: string): void => {
    if (window.matchMedia(narrow).matches) filesShown = false
    void workspace.openPath(path)
  }
  const createFile = (directory: string, name: string): void => {
    void workspace.createFile(directory, name)
  }
  const renameFile = (path: string, name: string): void => {
    void workspace.renameFile(path, name)
  }
  const deleteFile = (path: string): void => {
    void workspace.deleteFile(path)
  }
  const isDirty = (path: string): boolean => workspace.opened.get(path)?.dirty ?? false
  const toggleFiles = (): void => {
    filesShown = !filesShown
  }
  /** Coming back to the page, for example from another app, is when the file may have changed. */
  const onfocus = (): void => {
    void workspace.checkDisk()
  }
  const openWith = (read: () => Promise<OpenedFile>): void => {
    void workspace.openWith(read)
  }
  const save = (): void => {
    void workspace.save()
  }
  const saveAs = (): void => {
    void workspace.saveAs()
  }

  /** Handles ⌘/Ctrl+O (open), ⌘/Ctrl+S (save) and ⌘/Ctrl+Shift+S (save as). */
  const onkeydown = (event: KeyboardEvent): void => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return

    switch (event.key.toLowerCase()) {
      case 'o':
        event.preventDefault()
        open()
        break
      case 's':
        event.preventDefault()
        if (event.shiftKey) saveAs()
        else save()
        break
    }
  }

  /** Asks the browser to confirm leaving the page while there are unsaved changes. */
  const onbeforeunload = (event: BeforeUnloadEvent): void => {
    if (workspace.dirty) event.preventDefault()
  }
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="theme-color" content={themeColor} />
</svelte:head>

<svelte:window {onkeydown} {onbeforeunload} {onfocus} />

<header>
  {#if workspace.folder}
    <button
      type="button"
      class="toggle"
      aria-label="Files"
      aria-expanded={filesShown}
      aria-controls="files"
      onclick={toggleFiles}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5" />
        <path d="M6.25 2.75v10.5" />
      </svg>
    </button>
  {/if}
  <p class="file">
    <span class="name">{workspace.file.name}</span>
    {#if workspace.file.dirty}
      <span>Edited</span>
    {/if}
  </p>
  {#if workspace.error}
    <p class="error" role="alert">{workspace.error}</p>
  {/if}
  <p title={characters}>{words}</p>
  <div class="actions">
    <button type="button" onclick={newFile}>New</button>
    <button type="button" onclick={open} aria-keyshortcuts="Control+O Meta+O">Open</button>
    {#if canOpenFolders()}
      <button type="button" onclick={openFolder}>Open folder</button>
    {/if}
    <button type="button" onclick={save} aria-keyshortcuts="Control+S Meta+S">Save</button>
    <button type="button" onclick={saveAs} aria-keyshortcuts="Control+Shift+S Meta+Shift+S">
      Save as
    </button>
  </div>
  <button type="button" class="icon" popovertarget="preferences" aria-label="Preferences">
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6" />
      <circle cx="10" cy="4.5" r="1.5" />
      <circle cx="6" cy="11.5" r="1.5" />
    </svg>
  </button>
</header>

<PreferencesPanel id="preferences" {preferences} />

{#if workspace.folder && filesShown}
  <!-- On narrow screens, where the files cover the editor, a click beside them closes them. -->
  <button type="button" class="scrim" tabindex="-1" aria-label="Close files" onclick={toggleFiles}
  ></button>
  <aside id="files">
    <FileTree
      folder={workspace.folder}
      current={workspace.file.path}
      {isDirty}
      onopen={openPath}
      oncreate={createFile}
      onrename={renameFile}
      ondelete={deleteFile}
    />
  </aside>
{/if}

<main>
  <!-- Another file gets another editor, with its own state such as undo history, restored from
       its snapshot if it was shown before. A file reloaded from disk keeps its editor, which takes
       over the new content. -->
  {#key workspace.file}
    <Editor
      doc={workspace.file.loaded}
      snapshot={workspace.file.snapshot}
      onleave={keepSnapshot(workspace.file)}
      language={languageFor(workspace.file.name)}
      extensions={folderFiles}
      {appearance}
      {onchange}
      {onselect}
    />
  {/key}
</main>

<DropOverlay ondropfile={openWith} />
<ConfirmDialog {confirmation} />

<style>
  header {
    grid-area: header;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 1rem;
    /* Aligns the file name and the last button's label with the editor's minimum side padding. */
    padding: 0.5rem 0.875rem 0.5rem 1.5rem;
    font-size: 0.875rem;
    color: var(--color-muted);
  }

  p {
    margin: 0;
  }

  .file {
    display: flex;
    gap: 0.5rem;
    min-width: 0;
    margin-inline-end: auto;
    white-space: nowrap;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--color-text);
  }

  .error {
    color: var(--color-danger);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;

    /* Below the rest on narrow screens, which keeps the preferences on the first line. */
    @media (width < 40rem) {
      order: 1;
    }
  }

  .toggle {
    margin-inline: -0.75rem -0.5rem;
  }

  /* The preferences open under this. */
  .icon {
    margin-inline-start: -0.75rem;
    anchor-name: --preferences;
  }

  .toggle,
  .icon {
    display: grid;
    padding: 0.25rem 0.5rem;

    & svg {
      inline-size: 1rem;
      block-size: 1rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.25;
    }
  }

  aside {
    grid-area: sidebar;
    inline-size: 16rem;
    overflow-y: auto;
    border-inline-end: 1px solid var(--color-border);
    background-color: var(--color-bg);

    /* Over the editor on narrow screens, with room to see there's more beyond. */
    @media (width < 48rem) {
      grid-area: main;
      z-index: 5;
      inline-size: min(18rem, 85%);
      box-shadow: 0 0 2rem rgb(0 0 0 / 0.2);
    }
  }

  main {
    grid-area: main;
    min-inline-size: 0;
  }

  .scrim {
    display: none;

    @media (width < 48rem) {
      display: block;
      grid-area: main;
      z-index: 4;
      border-radius: 0;
      background-color: rgb(0 0 0 / 0.15);

      &:hover {
        background-color: rgb(0 0 0 / 0.15);
      }
    }
  }
</style>
