<script lang="ts" generics="T extends string">
  interface Props {
    label: string
    /** Each option's value and text. */
    options: readonly (readonly [T, string])[]
    value: T
  }

  let { label, options, value = $bindable() }: Props = $props()

  const id = $props.id()
</script>

<!-- A label and its choices, two cells of the panel's grid. -->
<span id="{id}-label" class="label">{label}</span>
<div class="segments" role="radiogroup" aria-labelledby="{id}-label">
  {#each options as [option, text] (option)}
    <label>
      <input type="radio" class="visually-hidden" name={id} value={option} bind:group={value} />
      <span>{text}</span>
    </label>
  {/each}
</div>

<style>
  .label {
    color: var(--color-muted);
  }

  .segments {
    display: flex;
    padding: 0.125rem;
    border-radius: 0.5rem;
    background-color: var(--color-hover);

    & label {
      flex: 1;
    }

    & span {
      display: block;
      padding: 0.25rem 0.75rem;
      border-radius: 0.375rem;
      color: var(--color-muted);
      text-align: center;
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
