<script lang="ts">
  interface Props {
    label: string
    checked: boolean
  }

  let { label, checked = $bindable() }: Props = $props()

  const id = $props.id()
</script>

<!-- A label and its switch, two cells of the settings' grid. -->
<label for={id}>{label}</label>
<input {id} type="checkbox" role="switch" bind:checked />

<style>
  label {
    cursor: pointer;
  }

  /* A track with a knob that slides to the end when on. */
  input {
    position: relative;
    justify-self: end;
    inline-size: 2.125rem;
    block-size: 1.25rem;
    margin: 0;
    border-radius: 1rem;
    background-color: var(--color-active);
    appearance: none;
    cursor: pointer;
    transition: background-color 0.15s;

    &::before {
      content: '';
      position: absolute;
      inset-block-start: 0.125rem;
      inset-inline-start: 0.125rem;
      inline-size: 1rem;
      block-size: 1rem;
      border-radius: 50%;
      background-color: #fff;
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
      transition: translate 0.15s;
    }

    &:checked {
      background-color: var(--color-accent);

      &::before {
        translate: 0.875rem 0;
      }
    }

    &:dir(rtl):checked::before {
      translate: -0.875rem 0;
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  }
</style>
