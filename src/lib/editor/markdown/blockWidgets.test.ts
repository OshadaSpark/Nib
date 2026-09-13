import type { EditorState } from '@codemirror/state'
import { WidgetType } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { blockDecorations, blockWidgets } from './blockWidgets'
import { markdownState } from './testState'
import { ImageWidget, TableWidget, type Table } from './widgets'

/** The block widgets, in document order. */
const widgets = (state: EditorState): { from: number; to: number; widget: WidgetType }[] => {
  const found = []
  const iter = blockDecorations(state).iter()
  while (iter.value) {
    const { widget } = iter.value.spec as { widget: unknown }
    if (widget instanceof WidgetType) found.push({ from: iter.from, to: iter.to, widget })
    iter.next()
  }
  return found
}

const images = (input: string): { at: number; src: string; alt: string }[] =>
  widgets(markdownState(input)).flatMap(({ from, widget }) =>
    widget instanceof ImageWidget ? [{ at: from, src: widget.src, alt: widget.alt }] : [],
  )

const tables = (input: string): { from: number; to: number; table: Table }[] =>
  widgets(markdownState(input)).flatMap(({ from, to, widget }) =>
    widget instanceof TableWidget ? [{ from, to, table: widget.table }] : [],
  )

describe('images', () => {
  it('shows images below the line they are on', () => {
    expect(
      images('A ![one](data:image/png,1.png) and ![two](data:image/png,2.png) B\nnext'),
    ).toEqual([
      { at: 65, src: 'data:image/png,1.png', alt: 'one' },
      { at: 65, src: 'data:image/png,2.png', alt: 'two' },
    ])
  })

  it('resolves reference images', () => {
    expect(images('![alt][img]\n\n[img]: data:image/png,1.png')).toEqual([
      { at: 11, src: 'data:image/png,1.png', alt: 'alt' },
    ])
  })

  it('finds images in any block of text', () => {
    expect(images('# ![h](data:image/png,h.png)\n\n> - ![q](data:image/png,q.png)')).toHaveLength(2)
  })

  it.each([
    '![remote](https://a.com/1.png)',
    '![relative](image.png)',
    '![undefined][nothing]',
    '```md\n![code](data:image/png,1.png)\n```',
    '`![inline code](data:image/png,1.png)`',
    '| ![in a table](data:image/png,1.png) |\n| - |',
  ])('shows no image for %j', (input) => {
    expect(images(input)).toEqual([])
  })
})

describe('tables', () => {
  const source = '| Name | *Price* |\n| :-- | --: |\n| Tea | 2 |\n| Coffee |'

  it('renders a table in place of its lines while the selection is elsewhere', () => {
    const [table] = tables(`${source}\n\n‸after`)

    expect(table).toMatchObject({ from: 0, to: source.length })
    expect(table?.table).toEqual({
      align: ['left', 'right'],
      rows: [
        [
          { offset: 2, content: ['Name'] },
          { offset: 9, content: [{ type: 'em', children: ['Price'] }] },
        ],
        [
          { offset: 35, content: ['Tea'] },
          { offset: 41, content: ['2'] },
        ],
        [{ offset: 47, content: ['Coffee'] }],
      ],
    })
  })

  it('shows the source while the selection touches the table', () => {
    expect(tables(`${source}‸\n\nafter`)).toEqual([])
    expect(tables(`before‸\n${source}`)).toHaveLength(1)
  })

  it('keeps empty cells in their columns', () => {
    const [table] = tables('a | b | c\n-|-|-\n|  | 2 |\n\n‸')

    expect(table?.table.align).toEqual([null, null, null])
    expect(table?.table.rows[1]).toEqual([
      { offset: 17, content: [] },
      { offset: 21, content: ['2'] },
    ])
  })

  it('covers whole lines, including a container’s markup', () => {
    expect(tables('> | a |\n> | - |\n> | 1 |\n\n‸')[0]).toMatchObject({ from: 0, to: 23 })
  })

  it('renders inline Markdown in cells', () => {
    const [table] = tables(
      '| **b** ~~s~~ `c` \\| &amp; |\n| - |\n| [l](https://a.com) <https://b.com> ![i](https://c.com/i.png) [u] |\n\n‸',
    )

    expect(table?.table.rows.map((row) => row.map((cell) => cell.content))).toEqual([
      [
        [
          { type: 'strong', children: ['b'] },
          ' ',
          { type: 's', children: ['s'] },
          ' ',
          { type: 'code', children: ['c'] },
          ' ',
          '|',
          ' ',
          { type: 'entity', entity: '&amp;' },
        ],
      ],
      [
        [
          { type: 'link', url: 'https://a.com', children: ['l'] },
          ' ',
          { type: 'link', url: 'https://b.com', children: ['https://b.com'] },
          ' ',
          { type: 'image', src: 'https://c.com/i.png', alt: 'i' },
          ' ',
          '[u]',
        ],
      ],
    ])
  })

  it('keeps the widget of an unchanged table, so its DOM is kept', () => {
    const state = markdownState(`${source}\n\n‸after`)
    const moved = state.update({ changes: { from: 0, insert: 'Intro\n\n' } }).state
    const [before] = widgets(state)
    const [after] = widgets(moved)
    if (!before || !after) throw new Error('No tables found')

    expect(after.from).toBe(before.from + 7)
    expect(after.widget.eq(before.widget)).toBe(true)
  })
})

describe('blockWidgets', () => {
  it('updates on changes and selection, and is kept otherwise', () => {
    let state = markdownState('‸\n\n| a |\n| - |')
    expect(state.field(blockWidgets).size).toBe(1)

    state = state.update({ selection: { anchor: 4 } }).state
    expect(state.field(blockWidgets).size).toBe(0)

    const unchanged = state.update({}).state
    expect(unchanged.field(blockWidgets)).toBe(state.field(blockWidgets))

    state = state.update({ changes: { from: 0, insert: '![i](data:image/png,i.png)' } }).state
    expect(state.field(blockWidgets).size).toBe(1)
  })
})
