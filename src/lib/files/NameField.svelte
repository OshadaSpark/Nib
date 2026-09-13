<script lang="ts">
  import type { Attachment } from 'svelte/attachments'

  interface Props {
    /** The name to start from; its part before the extension is selected. */
    value?: string
    label: string
    onsubmit: (name: string) => void
    oncancel: () => void
  }

  const { value = '', label, onsubmit, oncancel }: Props = $props()

  /** Set once submitted or cancelled, so that losing focus as the field goes doesn't do it again. */
  let done = false

  const finish = (name: string | null): void => {
    if (done) return
    done = true
    if (name?.trim() && name !== value) onsubmit(name.trim())
    else oncancel()
  }

  const focus: Attachment<HTMLInputElement> = (input) => {
    input.focus()
    const extension = input.value.lastIndexOf('.')
    input.setSelectionRange(0, extension > 0 ? extension : input.value.length)
  }

  // The key's default is prevented, as the editor may take focus before its input would follow.
  const onkeydown = (event: KeyboardEvent & { currentTarget: HTMLInputElement }): void => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return
    event.preventDefault()
    finish(event.key === 'Enter' ? event.currentTarget.value : null)
  }

  const onblur = (event: FocusEvent & { currentTarget: HTMLInputElement }): void => {
    finish(event.currentTarget.value)
  }
</script>

<input
  type="text"
  {value}
  aria-label={label}
  spellcheck="false"
  autocomplete="off"
  {onkeydown}
  {onblur}
  {@attach focus}
/>

<style>
  input {
    inline-size: 100%;
    padding-block: 0.1875rem;
    padding-inline: 0.5rem;
    border: 1px solid var(--color-accent);
    border-radius: 0.25rem;
    font: inherit;
    color: var(--color-text);
    background-color: var(--color-bg);
    outline: none;
  }
</style>
