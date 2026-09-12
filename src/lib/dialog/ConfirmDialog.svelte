<script lang="ts">
  import type { Attachment } from 'svelte/attachments'
  import type { Confirmation } from './confirmation.svelte'

  interface Props {
    confirmation: Confirmation
  }

  const { confirmation }: Props = $props()

  const id = $props.id()

  let dialog: HTMLDialogElement | undefined = $state()

  const showModal: Attachment<HTMLDialogElement> = (element) => {
    element.showModal()
  }

  // Every way of closing the dialog, including Escape, ends up here: only the confirm button sets
  // the return value.
  const onclose = (): void => {
    confirmation.answer(dialog?.returnValue === 'confirm')
  }
  const confirm = (): void => {
    dialog?.close('confirm')
  }
  const cancel = (): void => {
    dialog?.close()
  }
</script>

{#if confirmation.question}
  {@const question = confirmation.question}
  <dialog
    bind:this={dialog}
    {@attach showModal}
    closedby="any"
    aria-labelledby="{id}-title"
    aria-describedby="{id}-message"
    {onclose}
  >
    <h2 id="{id}-title">{question.title}</h2>
    <p id="{id}-message">{question.message}</p>
    <!-- Focused first, so that pressing Enter by accident keeps the user's work. -->
    <button type="button" onclick={cancel} autofocus>{question.cancel}</button>
    <button type="button" class="confirm" onclick={confirm}>{question.confirm}</button>
  </dialog>
{/if}

<style>
  dialog {
    inline-size: min(24rem, 100% - 2rem);
    padding: 1.25rem;
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
    font-size: 0.875rem;
    color: var(--color-text);
    background: var(--color-bg);
    box-shadow: var(--shadow-raised);
    transition: opacity 0.15s;

    @starting-style {
      opacity: 0;
    }

    &[open] {
      display: grid;
      /* The text spans all columns; the buttons sit at the end of the last row. */
      grid-template-columns: 1fr auto auto;
      gap: 0.5rem;
    }

    &::backdrop {
      background: rgb(0 0 0 / 0.3);
    }
  }

  h2,
  p {
    grid-column: 1 / -1;
    margin: 0;
  }

  h2 {
    font-size: 1rem;
    font-weight: 600;
  }

  p {
    margin-block-end: 0.75rem;
  }

  button:first-of-type {
    grid-column-start: 2;
  }

  .confirm {
    color: var(--color-bg);
    background-color: var(--color-danger);

    &:hover {
      color: var(--color-bg);
      background-color: color-mix(in srgb, var(--color-danger) 85%, var(--color-text));
    }
  }
</style>
