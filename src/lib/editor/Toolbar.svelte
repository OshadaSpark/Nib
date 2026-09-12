<script lang="ts">
  import { redo, undo } from '@codemirror/commands'
  import { openSearchPanel } from '@codemirror/search'
  import type { EditorView } from '@codemirror/view'
  import Icon, { type IconName } from '$lib/ui/Icon.svelte'
  import { isApple, keyShortcuts, shortcut } from '$lib/ui/shortcut'
  import {
    insertCodeBlock,
    insertRule,
    insertTable,
    toggleBold,
    toggleBulletList,
    toggleHeading,
    toggleInlineCode,
    toggleItalic,
    toggleLink,
    toggleOrderedList,
    toggleQuote,
    toggleStrikethrough,
    toggleTaskList,
  } from './markdown/formatting'

  interface Props {
    /** The editor the tools act on, once there is one. */
    view: EditorView | null
    /** Whether the file is Markdown, which the formatting tools are for. */
    markdown: boolean
  }

  const { view, markdown }: Props = $props()

  interface Tool {
    label: string
    icon: IconName
    run: (view: EditorView) => boolean
    /** The ⌘/Ctrl shortcut's key, and whether it takes Shift too. */
    keys?: [key: string, shift?: boolean]
  }

  const formattingTools: Tool[][] = [
    [
      { label: 'Bold', icon: 'bold', run: toggleBold, keys: ['B'] },
      { label: 'Italic', icon: 'italic', run: toggleItalic, keys: ['I'] },
      { label: 'Strikethrough', icon: 'strikethrough', run: toggleStrikethrough },
      { label: 'Code', icon: 'code', run: toggleInlineCode },
      { label: 'Link', icon: 'link', run: toggleLink, keys: ['K'] },
    ],
    [
      { label: 'Heading 1', icon: 'heading-1', run: toggleHeading(1) },
      { label: 'Heading 2', icon: 'heading-2', run: toggleHeading(2) },
      { label: 'Heading 3', icon: 'heading-3', run: toggleHeading(3) },
    ],
    [
      { label: 'Bulleted list', icon: 'bullet-list', run: toggleBulletList },
      { label: 'Numbered list', icon: 'ordered-list', run: toggleOrderedList },
      { label: 'Task list', icon: 'task', run: toggleTaskList },
      { label: 'Quote', icon: 'quote', run: toggleQuote },
    ],
    [
      { label: 'Code block', icon: 'code-block', run: insertCodeBlock },
      { label: 'Divider', icon: 'rule', run: insertRule },
      { label: 'Table', icon: 'table', run: insertTable },
    ],
  ]

  const editingTools: Tool[] = [
    { label: 'Undo', icon: 'undo', run: undo, keys: ['Z'] },
    // As CodeMirror's history keymap has it.
    { label: 'Redo', icon: 'redo', run: redo, keys: isApple ? ['Z', true] : ['Y'] },
    { label: 'Find and replace', icon: 'find', run: openSearchPanel, keys: ['F'] },
  ]

  /** Plain text files only get the editing tools. */
  const groups = $derived(markdown ? [...formattingTools, editingTools] : [editingTools])
  const tools = $derived(groups.flat())

  const use = (tool: Tool): void => {
    if (!view) return
    tool.run(view)
    view.focus()
  }

  /** Keeps the editor focused, and its selection shown, when a tool is clicked. */
  const keepFocus = (event: PointerEvent): void => {
    event.preventDefault()
  }

  // One tool is in the tab order at a time, the last one used; the arrow keys move between them.
  let active = $state(0)
  const current = $derived(Math.min(active, tools.length - 1))
  let toolbar: HTMLElement | undefined = $state()

  const onkeydown = (event: KeyboardEvent): void => {
    const last = tools.length - 1
    const next = {
      ArrowRight: current === last ? 0 : current + 1,
      ArrowLeft: current === 0 ? last : current - 1,
      Home: 0,
      End: last,
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    active = next
    toolbar?.querySelectorAll('button')[next]?.focus()
  }
</script>

<!-- Focus stays on the tools, which handle the arrow keys through this. -->
<div
  class="toolbar"
  role="toolbar"
  aria-label="Formatting"
  tabindex="-1"
  bind:this={toolbar}
  {onkeydown}
>
  {#each groups as group, index (group)}
    {#if index > 0}<span class="separator"></span>{/if}
    {#each group as tool (tool.label)}
      {@const keys = tool.keys}
      <button
        type="button"
        class="icon-button"
        tabindex={tools.indexOf(tool) === current ? 0 : -1}
        aria-label={tool.label}
        aria-keyshortcuts={keys && keyShortcuts(...keys)}
        title={keys ? `${tool.label} (${shortcut(...keys)})` : tool.label}
        disabled={!view}
        onpointerdown={keepFocus}
        onfocus={() => {
          active = tools.indexOf(tool)
        }}
        onclick={() => {
          use(tool)
        }}
      >
        <Icon name={tool.icon} />
      </button>
    {/each}
  {/each}
</div>

<style>
  /* Centred over the text, scrolling sideways where it doesn't fit. */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: safe center;
    gap: 0.125rem;
    padding-block: 0.25rem;
    padding-inline: 0.5rem;
    overflow-x: auto;
    scrollbar-width: none;
    /* Fades out at the end, where more tools may be out of view. */
    mask-image: linear-gradient(to left, transparent, #000 1.5rem);
  }

  .icon-button {
    flex: none;

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  }

  .separator {
    flex: none;
    inline-size: 1px;
    block-size: 1rem;
    margin-inline: 0.375rem;
    background-color: var(--color-border);
  }
</style>
