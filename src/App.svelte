<script lang="ts">
  import type { EditorSelection, Text } from '@codemirror/state'
  import { onMount } from 'svelte'
  import { MediaQuery } from 'svelte/reactivity'
  import ConfirmDialog from '$lib/dialog/ConfirmDialog.svelte'
  import { Confirmation } from '$lib/dialog/confirmation.svelte'
  import Editor from '$lib/editor/Editor.svelte'
  import { languageFor } from '$lib/editor/extensions'
  import { localFiles } from '$lib/editor/markdown/links'
  import type { EditorSnapshot } from '$lib/editor/snapshot'
  import DropOverlay from '$lib/files/DropOverlay.svelte'
  import { readFile, type OpenedFile } from '$lib/files/fileAccess'
  import FileTree from '$lib/files/FileTree.svelte'
  import type { TextFile } from '$lib/files/textFile.svelte'
  import { Workspace } from '$lib/files/workspace.svelte'
  import { Preferences } from '$lib/preferences/preferences.svelte'
  import Header from './Header.svelte'

  const confirmation = new Confirmation()
  const workspace = new Workspace(confirmation.ask)
  const preferences = new Preferences()

  // Files opened from the system with the installed app (File Handling API, Chromium). Each launch
  // gets a window of its own, so this only has the file to open.
  onMount(() => {
    window.launchQueue?.setConsumer(({ files: [handle] }) => {
      if (handle instanceof FileSystemFileHandle) openWith(() => readFile(handle))
    })
  })

  $effect(() => {
    preferences.save()
  })

  // The page follows the system's colour scheme unless the user picked one (see `app.css`).
  $effect(() => {
    document.documentElement.dataset.theme = preferences.theme
  })

  const systemDark = new MediaQuery('(prefers-color-scheme: dark)')
  /** Colours the browser's or installed app's title bar like the page (`--color-bg`). */
  const themeColor = $derived(
    preferences.theme === 'dark' || (preferences.theme === 'system' && systemDark.current)
      ? '#19191b'
      : '#fdfdfc',
  )

  const title = $derived(`${workspace.file.dirty ? '• ' : ''}${workspace.file.name} — typer`)

  /** The editor's selection, for the word count. */
  let selection = $state.raw<EditorSelection | null>(null)

  const onchange = (doc: Text): void => {
    workspace.file.content = doc
  }
  const onselect = (value: EditorSelection): void => {
    selection = value
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

  const filesId = 'files'
  /** Whether the file tree shows, once a folder is open. */
  let filesShown = $state(true)
  /** Where the file tree covers the editor rather than sitting beside it (as in the styles). */
  const narrow = new MediaQuery('(width < 48rem)')

  const closeFiles = (): void => {
    filesShown = false
  }

  // Actions handle their own failures, so their promises need not be awaited.
  const openPath = (path: string): void => {
    if (narrow.current) closeFiles()
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
  const openWith = (read: () => Promise<OpenedFile>): void => {
    void workspace.openWith(read)
  }

  /** Coming back to the page, for example from another app, is when the file may have changed. */
  const onfocus = (): void => {
    void workspace.checkDisk()
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

<svelte:window {onbeforeunload} {onfocus} />

<Header {workspace} {preferences} {selection} {filesId} bind:filesShown />

{#if workspace.folder && filesShown}
  <!-- On narrow screens, where the files cover the editor, a click beside them closes them. -->
  <button type="button" class="scrim" tabindex="-1" aria-label="Close files" onclick={closeFiles}
  ></button>
  <aside id={filesId}>
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
      language={languageFor(workspace.file.name, preferences.livePreview)}
      extensions={folderFiles}
      appearance={preferences.appearance}
      {onchange}
      {onselect}
    />
  {/key}
</main>

<DropOverlay ondropfile={openWith} />
<ConfirmDialog {confirmation} />

<style>
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
