<script lang="ts">
  import { droppedFile, type OpenedFile } from './fileAccess'

  interface Props {
    /** Called with a function that reads the dropped file. */
    ondropfile: (read: () => Promise<OpenedFile>) => void
  }

  const { ondropfile }: Props = $props()

  let dragging = $state(false)
  let overlay: HTMLElement | undefined = $state()

  // Drags of text within the page don't carry files, and are left to the editor.
  const hasFiles = (event: DragEvent): boolean =>
    event.dataTransfer?.types.includes('Files') ?? false

  const ondragenter = (event: DragEvent): void => {
    if (hasFiles(event)) dragging = true
  }

  /** Allows dropping files anywhere on the page. */
  const ondragover = (event: DragEvent): void => {
    if (!hasFiles(event)) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  }

  // The overlay covers the page, so a drag only leaves it by leaving the window (or being
  // cancelled). Other elements report leaving too, when the overlay first appears over them.
  const ondragleave = (event: DragEvent): void => {
    if (event.target === overlay) dragging = false
  }

  // Captured, so that the editor doesn't insert the file's text where it was dropped.
  const ondrop = (event: DragEvent): void => {
    const read = event.dataTransfer && droppedFile(event.dataTransfer)
    dragging = false
    if (!read) return
    event.preventDefault()
    event.stopPropagation()
    ondropfile(read)
  }
</script>

<svelte:window {ondragenter} {ondragover} {ondragleave} ondropcapture={ondrop} />

{#if dragging}
  <div class="overlay" bind:this={overlay}>
    <p>Drop to open</p>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: grid;
    place-items: center;
    background-color: color-mix(in srgb, var(--color-bg) 85%, transparent);
    outline: 2px dashed var(--color-accent);
    outline-offset: -0.75rem;
  }

  p {
    margin: 0;
    color: var(--color-accent);
    /* Leaves the overlay as the only target of the drag. */
    pointer-events: none;
  }
</style>
