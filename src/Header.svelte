<script lang="ts">
  import { canOpenFolders } from '$lib/files/fileAccess'
  import type { Workspace } from '$lib/files/workspace.svelte'
  import type { Preferences } from '$lib/preferences/preferences.svelte'
  import PreferencesPanel from '$lib/preferences/PreferencesPanel.svelte'
  import Icon from '$lib/ui/Icon.svelte'

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

  const isApple = /Mac|iPhone|iPad/.test(navigator.userAgent)

  /** A ⌘/Ctrl shortcut, in the platform's notation (⇧⌘S or Ctrl+Shift+S). */
  const shortcut = (key: string, shift = false): string =>
    isApple ? `${shift ? '⇧' : ''}⌘${key}` : `Ctrl+${shift ? 'Shift+' : ''}${key}`

  interface Command {
    label: string
    run: () => void
    /** The shortcut as shown, and as `aria-keyshortcuts` has it. */
    shortcut?: { shown: string; keys: string }
  }

  /** The file menu's commands, in groups. */
  const commands: Command[][] = [
    [
      { label: 'New', run: newFile },
      { label: 'Open', run: open, shortcut: { shown: shortcut('O'), keys: 'Control+O Meta+O' } },
      ...(canOpenFolders() ? [{ label: 'Open folder', run: openFolder }] : []),
    ],
    [
      { label: 'Save', run: save, shortcut: { shown: shortcut('S'), keys: 'Control+S Meta+S' } },
      {
        label: 'Save as',
        run: saveAs,
        shortcut: { shown: shortcut('S', true), keys: 'Control+Shift+S Meta+Shift+S' },
      },
    ],
  ]

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
  <p class="file">
    <span class="truncate">{workspace.file.name}</span>
    {#if workspace.file.dirty}
      <span class="edited">Edited</span>
    {/if}
  </p>
  <div class="actions">
    <button type="button" class="icon-button menu" popovertarget={menuId} aria-label="File">
      <Icon name="more" />
    </button>
    <button
      type="button"
      class="icon-button preferences"
      popovertarget="preferences"
      aria-label="Preferences"
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
      <button
        type="button"
        popovertarget={menuId}
        popovertargetaction="hide"
        aria-keyshortcuts={command.shortcut?.keys}
        onclick={command.run}
      >
        {command.label}
        {#if command.shortcut}
          <kbd aria-hidden="true">{command.shortcut.shown}</kbd>
        {/if}
      </button>
    {/each}
  {/each}
</div>

<PreferencesPanel id="preferences" {preferences} />

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
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    min-inline-size: 0;
    margin: 0;
    color: var(--color-text);
    font-weight: 500;
  }

  .edited {
    font-weight: 400;
    color: var(--color-muted);
  }

  .actions {
    grid-column: 3;
    justify-self: end;
    display: flex;
  }

  /* The menu and the preferences open under these. */
  .menu {
    anchor-name: --file-menu;
  }

  .preferences {
    anchor-name: --preferences;
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
