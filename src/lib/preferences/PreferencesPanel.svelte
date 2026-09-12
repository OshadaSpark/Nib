<script lang="ts">
  import { sizes, type Font, type Preferences, type Theme, type Width } from './preferences.svelte'
  import Segments from './Segments.svelte'
  import Stepper from './Stepper.svelte'

  interface Props {
    /**
     * The popover's id, which the button that opens it names in `popovertarget`. That button is
     * its anchor, named `--preferences` (see `.popover` in `app.css`).
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

<div {id} class="popover" popover="auto" role="dialog" aria-label="Preferences">
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
    position-anchor: --preferences;
    grid-template-columns: auto auto;
    align-items: center;
    gap: 0.75rem 1.5rem;
    inline-size: max-content;
    padding: 1rem;

    &:popover-open {
      display: grid;
    }
  }

  .check {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-block-start: 0.75rem;
    border-block-start: 1px solid var(--color-border);
    cursor: pointer;

    & input {
      margin: 0;
      accent-color: var(--color-accent);
    }
  }
</style>
