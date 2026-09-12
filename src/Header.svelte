<script lang="ts">
  import type { EditorSelection } from '@codemirror/state'
  import WordCount from '$lib/editor/WordCount.svelte'
  import { canOpenFolders } from '$lib/files/fileAccess'
  import type { Workspace } from '$lib/files/workspace.svelte'
  import type { Preferences } from '$lib/preferences/preferences.svelte'
  import PreferencesPanel from '$lib/preferences/PreferencesPanel.svelte'
  import Icon from '$lib/ui/Icon.svelte'

  interface Props {
    workspace: Workspace
    preferences: Preferences
    /** The editor's selection, whose words are counted. */
    selection: EditorSelection | null
    /** Whether the file tree shows, once a folder is open. */
    filesShown: boolean
    /** The file tree's id, for the button that shows and hides it. */
    filesId: string
  }

  let { workspace, preferences, selection, filesShown = $bindable(), filesId }: Props = $props()

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
      class="files"
      aria-label="Files"
      aria-expanded={filesShown}
      aria-controls={filesId}
      onclick={toggleFiles}
    >
      <Icon name="sidebar" />
    </button>
  {/if}
  <p class="file">
    <span class="name truncate">{workspace.file.name}</span>
    {#if workspace.file.dirty}
      <span>Edited</span>
    {/if}
  </p>
  {#if workspace.error}
    <p class="error" role="alert">{workspace.error}</p>
  {/if}
  <WordCount doc={workspace.file.content} {selection} />
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
  <button type="button" class="preferences" popovertarget="preferences" aria-label="Preferences">
    <Icon name="sliders" />
  </button>
</header>

<PreferencesPanel id="preferences" {preferences} />

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

  .files,
  .preferences {
    padding: 0.25rem 0.5rem;
  }

  .files {
    margin-inline: -0.75rem -0.5rem;
  }

  /* The preferences open under this. */
  .preferences {
    margin-inline-start: -0.75rem;
    anchor-name: --preferences;
  }
</style>
