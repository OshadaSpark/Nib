<script lang="ts">
  interface Props {
    label: string
    /** Accessible names of the buttons that step down and up. */
    decrease: string
    increase: string
    min: number
    max: number
    value: number
  }

  let { label, decrease, increase, min, max, value = $bindable() }: Props = $props()

  const id = $props.id()

  const stepDown = (): void => {
    value = Math.max(min, value - 1)
  }
  const stepUp = (): void => {
    value = Math.min(max, value + 1)
  }
</script>

<!-- A label and its control, two cells of the panel's grid. -->
<span id="{id}-label" class="label">{label}</span>
<div class="stepper" role="group" aria-labelledby="{id}-label">
  <button type="button" aria-label={decrease} disabled={value <= min} onclick={stepDown}>−</button>
  <output aria-live="polite">{value}</output>
  <button type="button" aria-label={increase} disabled={value >= max} onclick={stepUp}>+</button>
</div>

<style>
  .label {
    color: var(--color-muted);
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
