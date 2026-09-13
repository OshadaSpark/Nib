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
    font-size: 0.875rem;

    /* Not a grid, which WebKit stretches to the height of the window, between the dialog's insets. */
    &[open] {
      display: flex;
      flex-wrap: wrap;
      /* The text takes whole rows; the buttons sit at the end of the last one. */
      justify-content: end;
      gap: 0.5rem;
    }
  }

  h2,
  p {
    flex-basis: 100%;
    margin: 0;
  }

  h2 {
    font-size: 1rem;
    font-weight: 600;
  }

  p {
    margin-block-end: 1rem;
    color: var(--color-subtle);
  }

  button {
    padding: 0.375rem 0.875rem;
    font-weight: 500;
    background-color: var(--color-hover);

    &:hover {
      background-color: var(--color-active);
    }
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
