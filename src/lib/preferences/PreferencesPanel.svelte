<script lang="ts">
  import type { Preferences, Theme } from './preferences.svelte'

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
</script>

<div {id} popover="auto" role="dialog" aria-label="Preferences">
  <div class="row">
    <span id="{id}-theme">Theme</span>
    <div class="segments" role="radiogroup" aria-labelledby="{id}-theme">
      {#each themeOptions as [value, label] (value)}
        <label>
          <input
            type="radio"
            class="visually-hidden"
            name="{id}-theme"
            {value}
            bind:group={preferences.theme}
          />
          <span>{label}</span>
        </label>
      {/each}
    </div>
  </div>
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
    gap: 0.75rem;
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

  .row {
    display: grid;
    grid-template-columns: 4rem auto;
    align-items: center;
    gap: 1rem;
    color: var(--color-muted);
  }

  .segments {
    display: flex;
    padding: 0.125rem;
    border-radius: 0.5rem;
    background-color: var(--color-hover);

    & span {
      display: block;
      padding: 0.25rem 0.75rem;
      border-radius: 0.375rem;
      color: var(--color-muted);
      cursor: pointer;
    }

    & input:checked + span {
      color: var(--color-text);
      background-color: var(--color-bg);
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.15);
    }

    & input:focus-visible + span {
      outline: 2px solid var(--color-accent);
    }
  }
</style>
