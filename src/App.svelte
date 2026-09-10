<script lang="ts">
  import type { Text } from '@codemirror/state'
  import { languageFor } from '$lib/editor/extensions'
  import Editor from '$lib/editor/Editor.svelte'
  import { Workspace } from '$lib/files/workspace.svelte'

  const workspace = new Workspace()

  const title = $derived(`${workspace.file.dirty ? '• ' : ''}${workspace.file.name} — typer`)

  const onchange = (doc: Text): void => {
    workspace.file.content = doc
  }

  // Actions handle their own failures, so their promises need not be awaited.
  const newFile = (): void => {
    workspace.newFile()
  }
  const open = (): void => {
    void workspace.open()
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
    if (workspace.file.dirty) event.preventDefault()
  }
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

<svelte:window {onkeydown} {onbeforeunload} />

<header>
  <p class="file">
    <span class="name">{workspace.file.name}</span>
    {#if workspace.file.dirty}
      <span>Edited</span>
    {/if}
  </p>
  {#if workspace.error}
    <p class="error" role="alert">{workspace.error}</p>
  {/if}
  <div class="actions">
    <button type="button" onclick={newFile}>New</button>
    <button type="button" onclick={open} aria-keyshortcuts="Control+O Meta+O">Open</button>
    <button type="button" onclick={save} aria-keyshortcuts="Control+S Meta+S">Save</button>
    <button type="button" onclick={saveAs} aria-keyshortcuts="Control+Shift+S Meta+Shift+S">
      Save as
    </button>
  </div>
</header>

<main>
  <!-- A new file gets a new editor, so it starts with fresh state such as undo history. -->
  {#key workspace.file}
    <Editor doc={workspace.file.initial} language={languageFor(workspace.file.name)} {onchange} />
  {/key}
</main>

<style>
  header {
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
    gap: 0.25rem;
  }

  button {
    padding: 0.25rem 0.625rem;
    border: none;
    border-radius: 0.375rem;
    font: inherit;
    color: inherit;
    background: none;
    cursor: pointer;
    transition:
      color 0.15s,
      background-color 0.15s;

    &:hover {
      color: var(--color-text);
      background-color: var(--color-hover);
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }
</style>
