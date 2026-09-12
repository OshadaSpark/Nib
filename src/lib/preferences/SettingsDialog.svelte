<script lang="ts">
  import type { Attachment } from 'svelte/attachments'
  import Icon from '$lib/ui/Icon.svelte'
  import {
    sizes,
    statusItems,
    type Font,
    type Preferences,
    type StatusItem,
    type Theme,
    type Width,
  } from './preferences.svelte'
  import Segments from './Segments.svelte'
  import Stepper from './Stepper.svelte'
  import Switch from './Switch.svelte'

  interface Props {
    /** Whether the dialog shows; it sets this back to `false` as it closes. */
    open: boolean
    preferences: Preferences
  }

  let { open = $bindable(), preferences }: Props = $props()

  const id = $props.id()

  const themeOptions: [Theme, string][] = [
    ['system', 'System'],
    ['light', 'Light'],
    ['dark', 'Dark'],
  ]
  const fontOptions: [Font, string][] = [
    ['sans', 'Sans'],
    ['serif', 'Serif'],
    ['mono', 'Mono'],
  ]
  const widthOptions: [Width, string][] = [
    ['narrow', 'Narrow'],
    ['medium', 'Medium'],
    ['wide', 'Wide'],
  ]
  const statusLabels: Record<StatusItem, string> = {
    state: 'Saved or edited',
    cursor: 'Cursor position',
    lines: 'Lines',
    words: 'Words',
    characters: 'Characters',
    type: 'File type',
    lineBreaks: 'Line endings',
    encoding: 'Encoding',
  }

  const showModal: Attachment<HTMLDialogElement> = (element) => {
    element.showModal()
  }

  let dialog: HTMLDialogElement | undefined = $state()

  const close = (): void => {
    dialog?.close()
  }
  const onclose = (): void => {
    open = false
  }
</script>

{#if open}
  <dialog bind:this={dialog} {@attach showModal} closedby="any" aria-labelledby={id} {onclose}>
    <div class="title">
      <h2 {id}>Settings</h2>
      <button type="button" class="icon-button" aria-label="Close" onclick={close}>
        <Icon name="close" />
      </button>
    </div>

    <section aria-labelledby="{id}-appearance">
      <h3 id="{id}-appearance">Appearance</h3>
      <Segments label="Theme" options={themeOptions} bind:value={preferences.theme} />
      <Segments label="Font" options={fontOptions} bind:value={preferences.font} />
      <Stepper
        label="Text size"
        decrease="Smaller text"
        increase="Larger text"
        {...sizes}
        bind:value={preferences.size}
      />
      <Segments label="Column width" options={widthOptions} bind:value={preferences.width} />
    </section>

    <section aria-labelledby="{id}-editor">
      <h3 id="{id}-editor">Editor</h3>
      <Switch label="Render Markdown" bind:checked={preferences.livePreview} />
      <Switch label="Line numbers" bind:checked={preferences.lineNumbers} />
      <Switch label="Check spelling" bind:checked={preferences.spellcheck} />
      <Switch label="Formatting toolbar" bind:checked={preferences.toolbar} />
      <Switch label="Fade controls while writing" bind:checked={preferences.fadeWhileWriting} />
    </section>

    <section aria-labelledby="{id}-status">
      <h3 id="{id}-status">Status bar</h3>
      {#each statusItems as item (item)}
        <Switch label={statusLabels[item]} bind:checked={preferences.status[item]} />
      {/each}
    </section>
  </dialog>
{/if}

<style>
  dialog {
    inline-size: min(28rem, 100% - 2rem);
    max-block-size: min(40rem, 100% - 2rem);
    padding-block-start: 0.75rem;
    overflow-y: auto;
    font-size: 0.875rem;
  }

  /* Stays at the top as the settings scroll, over the dialog's padding. */
  .title {
    position: sticky;
    inset-block-start: -0.75rem;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-block: -0.75rem 0.5rem;
    padding-block: 0.75rem 0.5rem;
    background-color: var(--color-raised);

    /* Its icon lines up with the controls' ends. */
    & button {
      margin-inline-end: -0.5rem;
    }
  }

  h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  /* Each setting's label and control are two cells of the grid, the controls as wide as the widest. */
  section {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.875rem 1.5rem;

    & + section {
      margin-block-start: 1.5rem;
      padding-block-start: 1.25rem;
      border-block-start: 1px solid var(--color-border);
    }
  }

  h3 {
    grid-column: 1 / -1;
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-subtle);
  }
</style>
