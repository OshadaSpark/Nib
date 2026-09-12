<script lang="ts">
  import { sizes, type Font, type Preferences, type Theme, type Width } from './preferences.svelte'
  import Segments from './Segments.svelte'
  import Stepper from './Stepper.svelte'

  interface Props {
    /**
     * The popover's id, which the button that opens it names in `popovertarget`. That button is
     * its anchor, named `--preferences`.
     */
    id: string
    preferences: Preferences
  }

  const { id, preferences }: Props = $props()

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
</script>

<div {id} popover="auto" role="dialog" aria-label="Preferences">
  <Segments label="Theme" options={themeOptions} bind:value={preferences.theme} />
  <Segments label="Font" options={fontOptions} bind:value={preferences.font} />
  <Stepper
    label="Size"
    decrease="Smaller text"
    increase="Larger text"
    {...sizes}
    bind:value={preferences.size}
  />
  <Segments label="Width" options={widthOptions} bind:value={preferences.width} />
  <label class="check">
    <input type="checkbox" bind:checked={preferences.livePreview} />
    Render Markdown
  </label>
</div>

<style>
  [popover] {
    display: none;
    grid-template-columns: auto auto;
    align-items: center;
    gap: 0.75rem 1.5rem;
    inline-size: max-content;
    max-inline-size: calc(100vw - 1.5rem);
    margin: 0;
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 0.75rem;
    font-size: 0.875rem;
    color: var(--color-text);
    background: var(--color-bg);
    box-shadow: var(--shadow-raised);
    /* Under the header, at its end, where the button that opens it is… */
    position: fixed;
    inset: 3rem 0.75rem auto auto;

    /* …or right under that button, where anchor positioning is supported. */
    @supports (position-area: block-end) {
      position-anchor: --preferences;
      position-area: block-end span-inline-start;
      position-try-fallbacks: flip-inline;
      inset: auto;
      margin-block-start: 0.5rem;
    }

    &:popover-open {
      display: grid;
    }
  }

  .check {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;

    & input {
      margin: 0;
      accent-color: var(--color-accent);
    }
  }
</style>
