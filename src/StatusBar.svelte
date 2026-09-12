<script lang="ts">
  import type { EditorSelection } from '@codemirror/state'
  import { countString, countText } from '$lib/editor/count'
  import { isMarkdownName } from '$lib/files/fileTypes'
  import type { TextFile } from '$lib/files/textFile.svelte'
  import type { StatusItem } from '$lib/preferences/preferences.svelte'

  interface Props {
    file: TextFile
    /** The editor's selection in the file's content, whose text is counted when it isn't empty. */
    selection: EditorSelection | null
    /** Which items to show. */
    items: Record<StatusItem, boolean>
  }

  const { file, selection, items }: Props = $props()

  const numbers = new Intl.NumberFormat()

  /** "1,234 words", or "12 of 1,234 words" for a selection. */
  const describe = (total: number, part: number | undefined, unit: string): string => {
    const amount = `${numbers.format(total)} ${unit}${total === 1 ? '' : 's'}`
    return part === undefined ? amount : `${numbers.format(part)} of ${amount}`
  }

  const doc = $derived(file.content)
  const counts = $derived(countText(doc))
  const range = $derived(selection?.main)
  const selected = $derived(
    range && !range.empty ? countString(doc.sliceString(range.from, range.to)) : undefined,
  )
  const cursor = $derived.by(() => {
    // Right after switching files, the selection is still the last file's until the editor reports.
    const head = Math.min(range?.head ?? 0, doc.length)
    const line = doc.lineAt(head)
    return { line: line.number, column: head - line.from + 1 }
  })

  /** "Edited" with unsaved changes, "Saved" for a file on disk without them. */
  const state = $derived(file.dirty ? 'Edited' : file.handle ? 'Saved' : null)
</script>

<!-- Everything in the status bar is also in the editor, so it isn't announced as it changes. -->
<div class="status">
  {#if items.state && state}
    <span class="state" class:edited={file.dirty}>{state}</span>
  {/if}
  <span class="details">
    {#if items.cursor}
      <span title="Line {cursor.line}, column {cursor.column}">
        Ln {numbers.format(cursor.line)}, Col {numbers.format(cursor.column)}
      </span>
    {/if}
    {#if items.lines}
      <span>{describe(doc.lines, undefined, 'line')}</span>
    {/if}
    {#if items.words}
      <span>{describe(counts.words, selected?.words, 'word')}</span>
    {/if}
    {#if items.characters}
      <span>{describe(counts.characters, selected?.characters, 'character')}</span>
    {/if}
    {#if items.type}
      <span>{isMarkdownName(file.name) ? 'Markdown' : 'Plain text'}</span>
    {/if}
    {#if items.lineBreaks}
      <span title={file.crlf ? 'Windows line endings' : 'Unix line endings'}>
        {file.crlf ? 'CRLF' : 'LF'}
      </span>
    {/if}
    {#if items.encoding}
      <span>{file.byteOrderMark ? 'UTF-8 with BOM' : 'UTF-8'}</span>
    {/if}
  </span>
</div>

<style>
  /* On one line, the details scrolling sideways where they don't fit. */
  .status {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    white-space: nowrap;
  }

  .state {
    display: flex;
    flex: none;
    align-items: center;
    gap: 0.375rem;
  }

  /* A dot, as beside edited files in the file tree. */
  .edited::before {
    content: '';
    inline-size: 0.375rem;
    block-size: 0.375rem;
    border-radius: 50%;
    background-color: var(--color-accent);
  }

  .details {
    display: flex;
    gap: 1.25rem;
    margin-inline-start: auto;
    overflow-x: auto;
    scrollbar-width: none;
    font-variant-numeric: tabular-nums;
  }
</style>
