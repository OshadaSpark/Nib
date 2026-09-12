<script lang="ts">
  import { sizes, type Font, type Preferences, type Theme, type Width } from './preferences.svelte'
  import Segments from './Segments.svelte'

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

  const smaller = (): void => {
    preferences.size = Math.max(sizes.min, preferences.size - 1)
  }
  const larger = (): void => {
    preferences.size = Math.min(sizes.max, preferences.size + 1)
  }
</script>

<div {id} popover="auto" role="dialog" aria-label="Preferences">
  <Segments label="Theme" options={themeOptions} bind:value={preferences.theme} />
  <Segments label="Font" options={fontOptions} bind:value={preferences.font} />
  <span id="{id}-size" class="label">Size</span>
  <div class="stepper" role="group" aria-labelledby="{id}-size">
    <button
      type="button"
      aria-label="Smaller text"
      disabled={preferences.size <= sizes.min}
      onclick={smaller}
    >
      −
    </button>
    <output aria-live="polite">{preferences.size}</output>
    <button
      type="button"
      aria-label="Larger text"
      disabled={preferences.size >= sizes.max}
      onclick={larger}
    >
      +
    </button>
  </div>
  <Segments label="Width" options={widthOptions} bind:value={preferences.width} />
  <label class="check">
    <input type="checkbox" bind:checked={preferences.livePreview} />
    Render Markdown
  </label>
</div>

<style>
  [popover] {
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
    box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.2);

    &:popover-open {
      display: grid;
    }
  }

  .label {
    color: var(--color-muted);
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

  .stepper {
    display: flex;
    align-items: center;
    justify-content: space-between;

    & button {
      inline-size: 2rem;
      padding-inline: 0;
      font-size: 1rem;

      &:disabled {
        opacity: 0.4;
        cursor: default;
      }
    }

    & output {
      font-variant-numeric: tabular-nums;
    }
  }
</style>
