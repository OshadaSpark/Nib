<script lang="ts" module>
  /** Outline icons, as path data on a 16 × 16 grid. */
  const paths = {
    bold: 'M4.5 3h4a2.5 2.5 0 0 1 0 5h-4zM4.5 8h4.75a2.5 2.5 0 0 1 0 5H4.5z',
    'bullet-list':
      'M6.5 4.5h7M6.5 8h7M6.5 11.5h7M2.5 4.5a.75.75 0 1 0 1.5 0a.75.75 0 1 0-1.5 0M2.5 8a.75.75 0 1 0 1.5 0a.75.75 0 1 0-1.5 0M2.5 11.5a.75.75 0 1 0 1.5 0a.75.75 0 1 0-1.5 0',
    chevron: 'm6 4 4 4-4 4',
    close: 'm4.5 4.5 7 7m0-7-7 7',
    code: 'M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5',
    'code-block':
      'M3.5 2.5h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM6.5 6.25 4.75 8l1.75 1.75M9.5 6.25 11.25 8 9.5 9.75',
    find: 'M7 11.5a4.5 4.5 0 1 0 0-9a4.5 4.5 0 1 0 0 9zM10.25 10.25l3.25 3.25',
    'heading-1': 'M2.5 4v8M7.5 4v8M2.5 8h5M10.75 6l1.75-1.5V12',
    'heading-2':
      'M2.5 4v8M7.5 4v8M2.5 8h5M10.25 6.25a1.75 1.75 0 0 1 3.5.25c0 1.5-3.5 3-3.5 5.5h3.5',
    'heading-3': 'M2.5 4v8M7.5 4v8M2.5 8h5M10.25 4.5h3.25l-1.75 2.5a1.75 1.75 0 1 1-1.5 3.5',
    italic: 'M7 3h5M4 13h5M9.5 3l-3 10',
    link: 'M7 9a2.5 2.5 0 0 0 3.5 0l2-2A2.5 2.5 0 0 0 9 3.5l-.75.75M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.5l.75-.75',
    more: 'M3 8a.75.75 0 1 0 1.5 0a.75.75 0 1 0-1.5 0M7.25 8a.75.75 0 1 0 1.5 0a.75.75 0 1 0-1.5 0M11.5 8a.75.75 0 1 0 1.5 0a.75.75 0 1 0-1.5 0',
    'ordered-list':
      'M7 4.5h6.5M7 8h6.5M7 11.5h6.5M2.5 3.5l1-.75V6.5M2.25 9.25a1 1 0 0 1 2 0c0 .75-2 1.5-2 2.75h2',
    pencil: 'M10.5 2.5 13.5 5.5 6 13H3v-3z',
    plus: 'M8 3v10M3 8h10',
    quote: 'M3 3.5v9M6.5 5h7M6.5 8h7M6.5 11h4.5',
    redo: 'M10.5 3.5l3 3-3 3M13.25 6.5H6.5a3.5 3.5 0 0 0 0 7H9',
    rule: 'M2 8h12M5 4.5h6M5 11.5h6',
    strikethrough:
      'M2.5 8h11M11 4.75C10.5 3.75 9.4 3 8 3 6.25 3 5 4 5 5.25c0 .75.4 1.35 1.1 1.75M5 11c.5 1.25 1.6 2 3 2 1.75 0 3-1 3-2.25 0-.55-.2-1-.55-1.35',
    table:
      'M3.5 3h9a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM2.5 6.5h11M2.5 9.75h11M8 6.5V13',
    task: 'M2.5 3.5h3v3h-3zM2.5 9.5h3v3h-3zM3.25 11l.75.75 1.5-1.75M8 5h5.5M8 11h5.5',
    sidebar:
      'M3.25 2.75h9.5a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-9.5a1.5 1.5 0 0 1-1.5-1.5v-7.5a1.5 1.5 0 0 1 1.5-1.5zM6.25 2.75v10.5',
    sliders:
      'M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6M8.5 4.5a1.5 1.5 0 0 0 3 0a1.5 1.5 0 0 0-3 0M4.5 11.5a1.5 1.5 0 0 0 3 0a1.5 1.5 0 0 0-3 0',
    trash: 'M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.75 8.5h6.5L12 4.5',
    undo: 'M5.5 3.5l-3 3 3 3M2.75 6.5H9.5a3.5 3.5 0 0 1 0 7H7',
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
