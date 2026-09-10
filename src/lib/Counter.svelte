<script lang="ts">
  let count = $state(0)

  const increment = (): void => {
    count += 1
  }
</script>

<button type="button" class="counter" onclick={increment}>
  Count is {count}
</button>
