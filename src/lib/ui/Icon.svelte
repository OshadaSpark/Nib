<script lang="ts" module>
  /** Outline icons, as path data on a 16 × 16 grid. */
  const paths = {
    chevron: 'm6 4 4 4-4 4',
    close: 'm4.5 4.5 7 7m0-7-7 7',
    more: 'M3 8a.75.75 0 1 0 1.5 0a.75.75 0 1 0-1.5 0M7.25 8a.75.75 0 1 0 1.5 0a.75.75 0 1 0-1.5 0M11.5 8a.75.75 0 1 0 1.5 0a.75.75 0 1 0-1.5 0',
    pencil: 'M10.5 2.5 13.5 5.5 6 13H3v-3z',
    plus: 'M8 3v10M3 8h10',
    sidebar:
      'M3.25 2.75h9.5a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-9.5a1.5 1.5 0 0 1-1.5-1.5v-7.5a1.5 1.5 0 0 1 1.5-1.5zM6.25 2.75v10.5',
    sliders:
      'M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6M8.5 4.5a1.5 1.5 0 0 0 3 0a1.5 1.5 0 0 0-3 0M4.5 11.5a1.5 1.5 0 0 0 3 0a1.5 1.5 0 0 0-3 0',
    trash: 'M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.75 8.5h6.5L12 4.5',
  } as const

  export type IconName = keyof typeof paths
</script>

<script lang="ts">
  interface Props {
    name: IconName
    /** Width and height, as a CSS length. */
    size?: string
  }

  const { name, size = '1rem' }: Props = $props()
</script>

<!-- Decorative: the button or link around it has the accessible name. -->
<svg viewBox="0 0 16 16" aria-hidden="true" style:inline-size={size} style:block-size={size}>
  <path d={paths[name]} />
</svg>

<style>
  svg {
    display: block;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.25;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
