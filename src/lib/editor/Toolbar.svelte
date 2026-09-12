<script lang="ts">
  import { redo, selectAll, undo } from '@codemirror/commands'
  import { closeSearchPanel, openSearchPanel } from '@codemirror/search'
  import type { EditorView } from '@codemirror/view'
  import Icon, { type IconName } from '$lib/ui/Icon.svelte'
  import { isApple, keyShortcuts, shortcut } from '$lib/ui/shortcut'
  import { copy, cut, paste } from './clipboard'
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
    /** Whether the formatting tools show: the file is Markdown, and the preferences want them. */
    formatting: boolean
    /** Whether the find and replace panel is open, which the find tool toggles. */
    searchShown: boolean
    /** Opens the settings, from the More menu. */
    onsettings: () => void
    /** The width in pixels of the row the toolbar shares with the file name. */
    room: number
  }

  const { view, formatting, searchShown, onsettings, room }: Props = $props()

  interface Tool {
    label: string
    icon: IconName
    run: (view: EditorView) => boolean
    /** The ⌘/Ctrl shortcut's key, and whether it takes Shift too. */
    keys?: [key: string, shift?: boolean]
    /** Whether the tool is on, for one that toggles. */
    pressed?: boolean
  }

  /** Tools in a popover menu, in sections, behind a button with the menu's label and icon. */
  interface Menu {
    label: string
    icon: IconName
    sections: Tool[][]
  }

  type Control = Tool | Menu

  const isMenu = (control: Control): control is Menu => 'sections' in control

  /** Tools that show in a row, or as a menu of their own (of one section) from the step `folds`. */
  interface Group extends Menu {
    /** The layout step from which the group folds into a menu, or 0 to always be one. */
    folds: number
  }

  const groups: Group[] = [
    {
      label: 'Text',
      icon: 'text',
      folds: 2,
      sections: [
        [
          { label: 'Bold', icon: 'bold', run: toggleBold, keys: ['B'] },
          { label: 'Italic', icon: 'italic', run: toggleItalic, keys: ['I'] },
          { label: 'Strikethrough', icon: 'strikethrough', run: toggleStrikethrough },
          { label: 'Code', icon: 'code', run: toggleInlineCode },
          { label: 'Link', icon: 'link', run: toggleLink, keys: ['K'] },
        ],
      ],
    },
    {
      label: 'Style',
      icon: 'heading',
      folds: 0,
      sections: [
        [
          { label: 'Heading 1', icon: 'heading-1', run: toggleHeading(1) },
          { label: 'Heading 2', icon: 'heading-2', run: toggleHeading(2) },
          { label: 'Heading 3', icon: 'heading-3', run: toggleHeading(3) },
          { label: 'Quote', icon: 'quote', run: toggleQuote },
        ],
      ],
    },
    {
      label: 'Lists',
      icon: 'bullet-list',
      folds: 1,
      sections: [
        [
          { label: 'Bulleted list', icon: 'bullet-list', run: toggleBulletList },
          { label: 'Numbered list', icon: 'ordered-list', run: toggleOrderedList },
          { label: 'Task list', icon: 'task', run: toggleTaskList },
        ],
      ],
    },
    {
      label: 'Insert',
      icon: 'plus',
      folds: 0,
      sections: [
        [
          { label: 'Code block', icon: 'code-block', run: insertCodeBlock },
          { label: 'Table', icon: 'table', run: insertTable },
          { label: 'Divider', icon: 'rule', run: insertRule },
        ],
      ],
    },
  ]

  const history: Tool[] = [
    { label: 'Undo', icon: 'undo', run: undo, keys: ['Z'] },
    // As CodeMirror's history keymap has it.
    { label: 'Redo', icon: 'redo', run: redo, keys: isApple ? ['Z', true] : ['Y'] },
  ]

  const editing: Tool[] = [
    { label: 'Cut', icon: 'cut', run: cut, keys: ['X'] },
    { label: 'Copy', icon: 'copy', run: copy, keys: ['C'] },
    { label: 'Paste', icon: 'paste', run: paste, keys: ['V'] },
    { label: 'Select all', icon: 'select-all', run: selectAll, keys: ['A'] },
  ]

  const settings: Tool = {
    label: 'Settings',
    icon: 'sliders',
    keys: [','],
    run: () => {
      onsettings()
      return true
    },
  }

  const find = $derived<Tool>({
    label: 'Find and replace',
    icon: 'find',
    keys: ['F'],
    pressed: searchShown,
    run: searchShown ? closeSearchPanel : openSearchPanel,
  })

  /** The step from which undo and redo move into the More menu. */
  const historyFolds = 3
  /** The last step, where the formatting tools share one menu. */
  const lastStep = 4

  /** The toolbar's controls at a layout `step`, in groups with separators between them. */
  const layout = (step: number): Control[][] => {
    const shown = formatting ? groups : []
    const bar: Control[][] =
      step === lastStep && shown.length > 0
        ? [[{ label: 'Format', icon: 'text', sections: shown.flatMap((group) => group.sections) }]]
        : shown.map((group) => (step >= group.folds ? [group] : group.sections.flat()))
    const historyFolded = step >= historyFolds
    if (!historyFolded) bar.push(history)
    const more: Menu = {
      label: 'More',
      icon: 'more',
      sections: [...(historyFolded ? [history] : []), editing, [settings]],
    }
    bar.push([find, more])
    return bar
  }

  // Widths in rem, as in the styles below, to work out which layout fits.
  const buttonWidth = 2
  const menuButtonWidth = 2.5
  const gap = 0.125
  const separatorWidth = 0.8125
  /** What the row keeps for the rest: its padding, the files and file menu buttons and a short name. */
  const reserved = 12
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

  const widthOf = (bar: Control[][]): number => {
    const controls = bar.flat()
    const buttons = controls.reduce(
      (sum, control) => sum + (isMenu(control) ? menuButtonWidth : buttonWidth),
      0,
    )
    // Gaps come between the controls and around the separators.
    return buttons + (bar.length - 1) * separatorWidth + (controls.length + bar.length - 2) * gap
  }

  /** The widest layout that fits, folding tools into menus as the space narrows. */
  const bar = $derived.by(() => {
    for (let step = 0; step < lastStep; step++) {
      const candidate = layout(step)
      if ((widthOf(candidate) + reserved) * rem <= room) return candidate
    }
    return layout(lastStep)
  })
  const controls = $derived(bar.flat())
  const menus = $derived(controls.filter(isMenu))

  const id = $props.id()
  const menuId = (menu: Menu): string => `${id}-${menu.label.toLowerCase()}`

  /**
   * Focuses the editor to carry on writing, unless the tool moved focus into it already (as find does,
   * to its search field).
   */
  const use = (tool: Tool): void => {
    if (!view) return
    tool.run(view)
    if (!view.dom.contains(document.activeElement)) view.focus()
  }

  /** Keeps the editor focused, and its selection shown, when a tool or menu is clicked. */
  const keepFocus = (event: PointerEvent): void => {
    event.preventDefault()
  }

  const keysOf = (control: Control): Tool['keys'] => (isMenu(control) ? undefined : control.keys)

  const title = (control: Control): string => {
    const keys = keysOf(control)
    return keys ? `${control.label} (${shortcut(...keys)})` : control.label
  }

  // One control is in the tab order at a time, the last one used; the arrow keys move between them.
  let active = $state(0)
  const current = $derived(Math.min(active, controls.length - 1))
  let toolbar: HTMLElement | undefined = $state()

  const onkeydown = (event: KeyboardEvent): void => {
    const last = controls.length - 1
    const next = {
      ArrowRight: current === last ? 0 : current + 1,
      ArrowLeft: current === 0 ? last : current - 1,
      Home: 0,
      End: last,
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    active = next
    toolbar?.querySelectorAll<HTMLElement>(':scope > button')[next]?.focus()
  }
</script>

<!-- Focus stays on the controls, which handle the arrow keys through this. -->
<div
  class="toolbar"
  role="toolbar"
  aria-label="Tools"
  tabindex="-1"
  bind:this={toolbar}
  {onkeydown}
>
  {#each bar as group, index (index)}
    {#if index > 0}<span class="separator"></span>{/if}
    {#each group as control (control.label)}
      {@const keys = keysOf(control)}
      <button
        type="button"
        class="icon-button"
        class:menu-button={isMenu(control)}
        tabindex={controls.indexOf(control) === current ? 0 : -1}
        aria-label={control.label}
        aria-keyshortcuts={keys && keyShortcuts(...keys)}
        aria-pressed={isMenu(control) ? undefined : control.pressed}
        title={title(control)}
        disabled={!view}
        popovertarget={isMenu(control) ? menuId(control) : undefined}
        style:anchor-name={isMenu(control) ? `--${menuId(control)}` : undefined}
        onpointerdown={keepFocus}
        onfocus={() => {
          active = controls.indexOf(control)
        }}
        onclick={() => {
          if (!isMenu(control)) use(control)
        }}
      >
        <Icon name={control.icon} />
        {#if isMenu(control)}<Icon name="caret" size="0.75rem" />{/if}
      </button>
    {/each}
  {/each}
</div>

<!-- Each tool closes its menu as it runs. -->
{#each menus as menu (menu.label)}
  {@const popover = menuId(menu)}
  <div
    id={popover}
    class="popover menu"
    popover="auto"
    role="group"
    aria-label={menu.label}
    style:position-anchor="--{popover}"
  >
    {#each menu.sections as section, index (index)}
      {#if index > 0}<hr />{/if}
      {#each section as tool (tool.label)}
        {@const keys = tool.keys}
        <button
          type="button"
          popovertarget={popover}
          popovertargetaction="hide"
          aria-keyshortcuts={keys && keyShortcuts(...keys)}
          onpointerdown={keepFocus}
          onclick={() => {
            use(tool)
          }}
        >
          <Icon name={tool.icon} />
          <span>{tool.label}</span>
          {#if keys}
            <kbd aria-hidden="true">{shortcut(...keys)}</kbd>
          {/if}
        </button>
      {/each}
    {/each}
  </div>
{/each}

<style>
  /* At the end of the row, leaving the rest to the file name. */
  .toolbar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 0.125rem;
    margin-inline-start: auto;
  }

  .icon-button {
    flex: none;

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }

    &[aria-pressed='true'] {
      color: var(--color-text);
      background-color: var(--color-active);
    }
  }

  /* The icon, and a caret for the menu it opens. */
  .menu-button {
    grid-auto-flow: column;
    gap: 0.125rem;
    inline-size: 2.5rem;
  }

  .separator {
    flex: none;
    inline-size: 1px;
    block-size: 1rem;
    margin-inline: 0.375rem;
    background-color: var(--color-border);
  }

  [popover] :global(svg) {
    color: var(--color-subtle);
  }
</style>
