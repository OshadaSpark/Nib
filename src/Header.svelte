<script lang="ts">
  import type { EditorView } from '@codemirror/view'
  import { onMount } from 'svelte'
  import { setAppMenu } from '$lib/desktop/menu'
  import { closeWindow } from '$lib/desktop/window'
  import Toolbar from '$lib/editor/Toolbar.svelte'
  import { isMarkdownName } from '$lib/files/fileTypes'
  import type { Workspace } from '$lib/files/workspace.svelte'
  import type { Preferences } from '$lib/preferences/preferences.svelte'
  import SettingsDialog from '$lib/preferences/SettingsDialog.svelte'
  import Icon from '$lib/ui/Icon.svelte'
  import { keyShortcuts, shortcut } from '$lib/ui/shortcut'

  interface Props {
    workspace: Workspace
    preferences: Preferences
    /** Whether the file tree shows, once a folder is open. */
    filesShown: boolean
    /** The file tree's id, for the button that shows and hides it. */
    filesId: string
    /** The editor, for the toolbar. */
    view: EditorView | null
    /** Whether the editor's find and replace panel is open. */
    searchShown: boolean
  }

  let {
    workspace,
    preferences,
    filesShown = $bindable(),
    filesId,
    view,
    searchShown,
  }: Props = $props()

  const menuId = 'file-menu'
  /** The header's width, which the toolbar fits its tools to. */
  let width = $state(0)
  let settingsOpen = $state(false)

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
  const save = (): void => {
    void workspace.save()
  }
  const saveAs = (): void => {
    void workspace.saveAs()
  }
  const toggleFiles = (): void => {
    filesShown = !filesShown
  }
  const openSettings = (): void => {
    settingsOpen = true
  }

  interface Command {
    label: string
    run: () => void
    /** The ⌘/Ctrl shortcut's key, and whether it takes Shift too. */
    keys?: [key: string, shift?: boolean]
  }

  /** The file menu's commands, in groups. */
  const commands: Command[][] = [
    [
      { label: 'New', run: newFile, keys: ['N'] },
      { label: 'Open', run: open, keys: ['O'] },
      { label: 'Open folder', run: openFolder, keys: ['O', true] },
    ],
    [
      { label: 'Save', run: save, keys: ['S'] },
      { label: 'Save as', run: saveAs, keys: ['S', true] },
    ],
  ]

  onMount(() => {
    setAppMenu({
      newFile,
      open,
      openFolder,
      save,
      saveAs,
      settings: openSettings,
      quit: () => {
        closeWindow().catch(console.error)
      },
    }).catch(console.error)
  })

  /**
   * Handles ⌘/Ctrl+O (open), ⌘/Ctrl+Shift+O (open folder), ⌘/Ctrl+S (save), ⌘/Ctrl+Shift+S (save
   * as) and ⌘/Ctrl+, (settings). The page gets keys before the menu bar, whose items show them.
   */
  const onkeydown = (event: KeyboardEvent): void => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return

    switch (event.key.toLowerCase()) {
      case ',':
        event.preventDefault()
        openSettings()
        break
      case 'o':
        event.preventDefault()
        if (event.shiftKey) openFolder()
        else open()
        break
      case 's':
        event.preventDefault()
        if (event.shiftKey) saveAs()
        else save()
        break
    }
  }
</script>

<svelte:window {onkeydown} />

<!-- The file's name at the start, with its menu, and the toolbar in the rest of the row. It stands
     in for the window's title bar, so it drags the window, except from its controls. -->
<header bind:clientWidth={width} data-tauri-drag-region="deep">
  {#if workspace.folder}
    <button
      type="button"
      class="icon-button"
      aria-label="Files"
      aria-expanded={filesShown}
      aria-controls={filesId}
      onclick={toggleFiles}
    >
      <Icon name="sidebar" />
    </button>
  {/if}
  <div class="title">
    <p class="file truncate" title={workspace.file.name}>{workspace.file.name}</p>
    <button type="button" class="icon-button file-menu" popovertarget={menuId} aria-label="File">
      <Icon name="caret" />
    </button>
  </div>
  <Toolbar
    {view}
    formatting={preferences.toolbar && isMarkdownName(workspace.file.name)}
    {searchShown}
    onsettings={openSettings}
    room={width}
  />
</header>

<!-- Each command closes the menu as it runs. -->
<div id={menuId} class="popover menu" popover="auto" role="group" aria-label="File">
  {#each commands as group, index (index)}
    {#if index > 0}<hr />{/if}
    {#each group as command (command.label)}
      {@const keys = command.keys}
      <button
        type="button"
        popovertarget={menuId}
        popovertargetaction="hide"
        aria-keyshortcuts={keys && keyShortcuts(...keys)}
        onclick={command.run}
      >
        {command.label}
        {#if keys}
          <kbd aria-hidden="true">{shortcut(...keys)}</kbd>
        {/if}
      </button>
    {/each}
  {/each}
</div>

<SettingsDialog bind:open={settingsOpen} {preferences} />

<style>
  header {
    grid-area: header;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    block-size: var(--bar-height);
    padding-inline: var(--window-controls) 0.5rem;
    font-size: 0.875rem;
    color: var(--color-subtle);
  }

  /* Takes what the toolbar leaves, cutting a long name short. */
  .title {
    display: flex;
    align-items: center;
    min-inline-size: 0;
  }

  .file {
    margin: 0;
    padding-inline-start: 0.375rem;
    color: var(--color-text);
    font-weight: 500;
  }

  /* The file menu opens under this, towards the end. */
  .file-menu {
    flex: none;
    anchor-name: --file-menu;
  }

  [popover] {
    position-anchor: --file-menu;

    @supports (position-area: block-end) {
      position-area: block-end span-inline-end;
    }
  }
</style>
