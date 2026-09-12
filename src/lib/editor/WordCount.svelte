<script lang="ts">
  import type { EditorSelection, Text } from '@codemirror/state'
  import { countString, countText } from './count'

  interface Props {
    doc: Text
    /** The editor's selection in `doc`, whose text is counted when it isn't empty. */
    selection: EditorSelection | null
  }

  const { doc, selection }: Props = $props()

  const numbers = new Intl.NumberFormat()

  /** "1,234 words", or "12 of 1,234 words" for a selection. */
  const describe = (total: number, part: number | undefined, unit: string): string => {
    const amount = `${numbers.format(total)} ${unit}${total === 1 ? '' : 's'}`
    return part === undefined ? amount : `${numbers.format(part)} of ${amount}`
  }

  const counts = $derived(countText(doc))
  const selected = $derived.by(() => {
    const range = selection?.main
    return range && !range.empty ? countString(doc.sliceString(range.from, range.to)) : undefined
  })
</script>

<p title={describe(counts.characters, selected?.characters, 'character')}>
  {describe(counts.words, selected?.words, 'word')}
</p>

<style>
  p {
    margin: 0;
  }
</style>
