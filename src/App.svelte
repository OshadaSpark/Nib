<script lang="ts">
  import { searchPanelOpen } from '@codemirror/search'
  import type { EditorSelection, Text } from '@codemirror/state'
  import { EditorView } from '@codemirror/view'
  import { onMount } from 'svelte'
  import { MediaQuery } from 'svelte/reactivity'
  import { watchOpenedFiles } from '$lib/desktop/openedFiles'
  import { whileMounted } from '$lib/desktop/whileMounted'
  import {
    guardClosing,
    setDocumentEdited,
    setWindowTheme,
    setWindowTitle,
    watchFullScreen,
  } from '$lib/desktop/window'
  import ConfirmDialog from '$lib/dialog/ConfirmDialog.svelte'
  import { Confirmation } from '$lib/dialog/confirmation.svelte'
  import Editor from '$lib/editor/Editor.svelte'
  import { languageFor } from '$lib/editor/extensions'
  import { localFiles } from '$lib/editor/markdown/links'
  import type { EditorSnapshot } from '$lib/editor/snapshot'
  import DropOverlay from '$lib/files/DropOverlay.svelte'
  import type { OpenedFile } from '$lib/files/fileAccess'
  import FileTree from '$lib/files/FileTree.svelte'
  import { loadSession, saveSession } from '$lib/files/session'
  import type { TextFile } from '$lib/files/textFile.svelte'
  import { Workspace } from '$lib/files/workspace.svelte'
  import { Preferences } from '$lib/preferences/preferences.svelte'
  import Icon from '$lib/ui/Icon.svelte'
  import Header from './Header.svelte'
  import StatusBar from './StatusBar.svelte'

  const confirmation = new Confirmation()
  const workspace = new Workspace(confirmation.ask)
  const preferences = new Preferences()

  $effect(() => {
    preferences.save()
  })

  // The page follows the system's colour scheme unless the user picked one (see `app.css`).
  $effect(() => {
    document.documentElement.dataset.theme = preferences.theme
  })

  const title = $derived(`${workspace.file.dirty ? '• ' : ''}${workspace.file.name} — Nib`)

  // The window around the page, in the app: its title, the dot for unsaved changes in its close
  // button, and its theme, for its buttons and the system's panels.
  $effect(() => {
    setWindowTitle(title).catch(console.error)
  })
  $effect(() => {
    setDocumentEdited(workspace.dirty).catch(console.error)
  })
  $effect(() => {
    setWindowTheme(preferences.theme === 'system' ? null : preferences.theme).catch(console.error)
  })

  /** Read before the effect below first saves what's open, which is nothing yet. */
  const lastSession = loadSession()
  $effect(() => {
    saveSession({ folder: workspace.folder?.location ?? null, file: workspace.file.location })
  })

  /**
   * Opens the files opened from the system (the first, of several), such as from Finder. On launch,
   * without any, opens again what was open last time.
   */
  const openFromSystem = async (): Promise<() => void> => {
    // A count, as TypeScript would take a flag set in the callback for always false.
    let opened = 0
    const stop = await watchOpenedFiles(([first]) => {
      opened += 1
      if (first) void workspace.openLocation(first)
    })
    if (opened === 0) await workspace.restore(lastSession)
    return stop
  }

  onMount(() => {
    const stops = [
      // In full screen, the window's buttons hide, and so does the room kept for them.
      whileMounted(
        watchFullScreen((fullScreen) => {
          document.documentElement.toggleAttribute('data-full-screen', fullScreen)
        }),
      ),
      whileMounted(guardClosing(() => workspace.confirmClose())),
      whileMounted(openFromSystem()),
    ]
    return () => {
      for (const stop of stops) stop()
    }
  })

  /** The editor's selection, for the status bar. */
  let selection = $state.raw<EditorSelection | null>(null)
  /** The editor, for the toolbar. */
  let view = $state.raw<EditorView | null>(null)
  /** Whether the editor's find and replace panel is open, which the toolbar toggles. */
  let searchShown = $state(false)

  /**
   * Whether the user is writing, which fades the controls around the editor (if the preferences
   * say so) until the pointer moves or touches the page.
   */
  let writing = $state(false)

  const onchange = (doc: Text): void => {
    workspace.file.content = doc
    writing = true
  }
  const stopWriting = (): void => {
    writing = false
  }
  const onselect = (value: EditorSelection): void => {
    selection = value
  }
  const onview = (value: EditorView | null): void => {
    view = value
    searchShown = value !== null && searchPanelOpen(value.state)
  }

  const editorExtensions = [
    // Relative links and images lead to the open folder's files.
    localFiles.of({
      open: (target) => workspace.openLink(target),
      imageURL: (src) => workspace.imageURL(src),
    }),
    EditorView.updateListener.of((update) => {
      searchShown = searchPanelOpen(update.state)
    }),
  ]

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
  const openDropped = (read: () => Promise<OpenedFile>): void => {
    void workspace.openDropped(read)
  }

  const dismissError = (): void => {
    workspace.error = null
  }

  /** Coming back to the page, for example from another app, is when the file may have changed. */
  const onfocus = (): void => {
    void workspace.checkDisk()
  }
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

<svelte:window {onfocus} onpointermove={stopWriting} onpointerdown={stopWriting} />

<div class="app" class:writing={writing && preferences.fadeWhileWriting}>
  <Header {workspace} {preferences} {filesId} bind:filesShown {view} {searchShown} />

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
         its snapshot if it was shown before. A file reloaded from disk keeps its editor, which
         takes over the new content. -->
    {#key workspace.file}
      <Editor
        doc={workspace.file.loaded}
        snapshot={workspace.file.snapshot}
        onleave={keepSnapshot(workspace.file)}
        language={languageFor(workspace.file.name, preferences.livePreview)}
        extensions={editorExtensions}
        appearance={preferences.appearance}
        {onchange}
        {onselect}
        {onview}
      />
    {/key}
    {#if workspace.error}
      <div class="error">
        <p role="alert">{workspace.error}</p>
        <button type="button" class="icon-button" aria-label="Dismiss" onclick={dismissError}>
          <Icon name="close" size="0.875rem" />
        </button>
      </div>
    {/if}
  </main>

  {#if Object.values(preferences.status).some(Boolean)}
    <footer>
      <StatusBar file={workspace.file} {selection} items={preferences.status} />
    </footer>
  {/if}
</div>

<DropOverlay ondropfile={openDropped} />
<ConfirmDialog {confirmation} />

<style>
  /* The file tree beside the header, editor and footer, when a folder is open. */
  .app {
    display: grid;
    grid-template:
      'sidebar header' auto
      'sidebar main' minmax(0, 1fr)
      'sidebar footer' auto
      / auto minmax(0, 1fr);
    block-size: 100dvh;

    /* Beside the file tree, the header leaves the window's controls to it. */
    @media (width >= 48rem) {
      &:has(> aside) > :global(header) {
        padding-inline-start: 0.5rem;
      }
    }

    /* Out of the way while writing, back when the pointer moves or the keyboard reaches them. */
    & > :global(header),
    & > footer {
      transition: opacity 0.4s;
    }

    &.writing > :global(header:not(:focus-within)),
    &.writing > footer {
      opacity: 0;
    }
  }

  aside {
    grid-area: sidebar;
    inline-size: 16rem;
    overflow-y: auto;
    border-inline-end: 1px solid var(--color-border);
    background-color: var(--color-chrome);

    /* A drawer over the page on narrow screens, with room to see there's more beyond. */
    @media (width < 48rem) {
      position: fixed;
      inset-block: 0;
      inset-inline-start: 0;
      z-index: 5;
      inline-size: min(18rem, 85%);
      border: none;
      box-shadow: var(--shadow-raised);
      transition: translate 0.2s ease-out;

      @starting-style {
        translate: -100% 0;
      }
    }
  }

  main {
    grid-area: main;
    position: relative;
    min-inline-size: 0;
  }

  footer {
    grid-area: footer;
    padding-block: 0.25rem 0.5rem;
    padding-inline: 1rem;
    font-size: 0.8125rem;
    color: var(--color-muted);
  }

  /* Floats over the bottom of the editor until dismissed or the next action. */
  .error {
    position: absolute;
    inset-block-end: 1rem;
    inset-inline: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    inline-size: fit-content;
    max-inline-size: calc(100% - 2rem);
    margin-inline: auto;
    padding-block: 0.25rem;
    padding-inline: 1rem 0.25rem;
    border-radius: 0.75rem;
    font-size: 0.875rem;
    color: var(--color-danger);
    background: var(--color-raised);
    box-shadow: var(--shadow-raised);
    transition:
      opacity 0.2s,
      translate 0.2s;

    @starting-style {
      opacity: 0;
      translate: 0 0.5rem;
    }

    & p {
      margin: 0;
    }
  }

  .scrim {
    display: none;

    @media (width < 48rem) {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 4;
      border-radius: 0;
      background-color: rgb(0 0 0 / 0.25);
      transition: opacity 0.2s;

      &:hover {
        background-color: rgb(0 0 0 / 0.25);
      }

      @starting-style {
        opacity: 0;
      }
    }
  }
</style>
