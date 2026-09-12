<script lang="ts">
  import { canOpenFolders } from '$lib/files/fileAccess'
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
  }

  let { workspace, preferences, filesShown = $bindable(), filesId }: Props = $props()

  const menuId = 'file-menu'
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
      { label: 'New', run: newFile },
      { label: 'Open', run: open, keys: ['O'] },
      ...(canOpenFolders() ? [{ label: 'Open folder', run: openFolder }] : []),
    ],
    [
      { label: 'Save', run: save, keys: ['S'] },
      { label: 'Save as', run: saveAs, keys: ['S', true] },
    ],
  ]

  /** Handles ⌘/Ctrl+O (open), ⌘/Ctrl+S (save), ⌘/Ctrl+Shift+S (save as) and ⌘/Ctrl+, (settings). */
  const onkeydown = (event: KeyboardEvent): void => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return

    switch (event.key.toLowerCase()) {
      case ',':
        event.preventDefault()
        openSettings()
        break
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
</script>

<svelte:window {onkeydown} />

<header>
  {#if workspace.folder}
    <button
      type="button"
      class="icon-button files"
      aria-label="Files"
      aria-expanded={filesShown}
      aria-controls={filesId}
      onclick={toggleFiles}
    >
      <Icon name="sidebar" />
    </button>
  {/if}
  <p class="file truncate">{workspace.file.name}</p>
  <div class="actions">
    <button type="button" class="icon-button menu" popovertarget={menuId} aria-label="File">
      <Icon name="more" />
    </button>
    <button
      type="button"
      class="icon-button"
      aria-label="Settings"
      aria-keyshortcuts={keyShortcuts(',')}
      title="Settings ({shortcut(',')})"
      onclick={openSettings}
    >
      <Icon name="sliders" />
    </button>
  </div>
</header>

<!-- Each command closes the menu as it runs. -->
<div id={menuId} class="popover" popover="auto" role="group" aria-label="File">
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
  /* The file's name in the middle, between the files button and the actions. */
  header {
    grid-area: header;
    display: grid;
    grid-template-columns: 1fr minmax(0, auto) 1fr;
    align-items: center;
    gap: 0.5rem;
    block-size: var(--bar-height);
    padding-inline: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-subtle);
  }

  .files {
    grid-column: 1;
  }

  .file {
    grid-column: 2;
    margin: 0;
    color: var(--color-text);
    font-weight: 500;
  }

  .actions {
    grid-column: 3;
    justify-self: end;
    display: flex;
  }

  /* The file menu opens under this. */
  .menu {
    anchor-name: --file-menu;
  }

  [popover] {
    position-anchor: --file-menu;
    min-inline-size: 13rem;

    &:popover-open {
      display: grid;
    }

    & button {
      display: flex;
      justify-content: space-between;
      gap: 2rem;
      padding: 0.375rem 0.625rem;
      text-align: start;
    }

    & hr {
      margin: 0.375rem 0.625rem;
      border: none;
      border-block-start: 1px solid var(--color-border);
    }
  }

  kbd {
    font: inherit;
    color: var(--color-muted);
  }
</style>
