<script lang="ts">
  import type { EditorSelection, Text } from '@codemirror/state'
  import ConfirmDialog from '$lib/dialog/ConfirmDialog.svelte'
  import { Confirmation } from '$lib/dialog/confirmation.svelte'
  import { countString, countText, type Counts } from '$lib/editor/count'
  import { languageFor } from '$lib/editor/extensions'
  import Editor from '$lib/editor/Editor.svelte'
  import DropOverlay from '$lib/files/DropOverlay.svelte'
  import type { OpenedFile } from '$lib/files/fileAccess'
  import { Workspace } from '$lib/files/workspace.svelte'

  const confirmation = new Confirmation()
  const workspace = new Workspace(confirmation.ask)

  const title = $derived(`${workspace.file.dirty ? '• ' : ''}${workspace.file.name} — typer`)

  const onchange = (doc: Text): void => {
    workspace.file.content = doc
  }

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
  /** Coming back to the page, for example from another app, is when the file may have changed. */
  const onfocus = (): void => {
    void workspace.checkDisk()
  }
  const openDropped = (read: () => Promise<OpenedFile>): void => {
    void workspace.openDropped(read)
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

<svelte:window {onkeydown} {onbeforeunload} {onfocus} />

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
  <p title={characters}>{words}</p>
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
  <!-- A new file gets a new editor, so it starts with fresh state such as undo history. A file
       reloaded from disk keeps its editor, which takes over the new content. -->
  {#key workspace.file}
    <Editor
      doc={workspace.file.loaded}
      language={languageFor(workspace.file.name)}
      {onchange}
      {onselect}
    />
  {/key}
</main>

<DropOverlay ondropfile={openDropped} />
<ConfirmDialog {confirmation} />

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
</style>
