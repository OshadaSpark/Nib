import { WidgetType, type EditorView } from '@codemirror/view'
import { isShowableImage, openLink } from './links'

/** Inline Markdown content, as rendered in table cells. */
export type Inline =
  | string
  | { type: 'strong' | 'em' | 's' | 'code'; children: Inline[] }
  | { type: 'link'; url: string; children: Inline[] }
  | { type: 'image'; src: string; alt: string }
  | { type: 'entity'; entity: string }

export interface TableCell {
  /** Where the cell's text starts, relative to the start of the table. */
  offset: number
  content: Inline[]
}

export interface Table {
  /** One entry per column. */
  align: ('left' | 'center' | 'right' | null)[]
  /** The header row, then the body rows. Rows may have fewer cells than there are columns. */
  rows: TableCell[][]
}

/** An element showing an HTML entity, such as `&amp;`, as the character it stands for. */
const entityElement = (entity: string): HTMLElement => {
  const span = document.createElement('span')
  // Safe as HTML: the parser only accepts `&name;`, `&#digits;` and `&#xhex;` as entities.
  span.innerHTML = entity
  return span
}

const imageElement = (src: string, alt: string, view: EditorView): HTMLImageElement => {
  const image = document.createElement('img')
  image.src = src
  image.alt = alt
  image.referrerPolicy = 'no-referrer'
  // Loading changes the image's size, which the editor needs to measure again.
  image.addEventListener('load', () => {
    view.requestMeasure()
  })
  return image
}

const renderInline = (content: readonly Inline[], view: EditorView): (Node | string)[] =>
  content.map((item) => {
    if (typeof item === 'string') return item
    switch (item.type) {
      case 'entity':
        return entityElement(item.entity)
      case 'image':
        return isShowableImage(item.src) ? imageElement(item.src, item.alt, view) : item.alt
      case 'link': {
        const span = document.createElement('span')
        span.className = 'cm-link'
        span.dataset.url = item.url
        span.append(...renderInline(item.children, view))
        return span
      }
      default: {
        const element = document.createElement(item.type)
        element.append(...renderInline(item.children, view))
        return element
      }
    }
  })

/** Shows an HTML entity, such as `&amp;`, as the character it stands for. */
export class EntityWidget extends WidgetType {
  readonly entity: string

  constructor(entity: string) {
    super()
    this.entity = entity
  }

  override eq(other: EntityWidget): boolean {
    return other.entity === this.entity
  }

  toDOM(): HTMLElement {
    return entityElement(this.entity)
  }
}

/** A bullet list marker. */
export class BulletWidget extends WidgetType {
  readonly glyph: string

  constructor(glyph: string) {
    super()
    this.glyph = glyph
  }

  override eq(other: BulletWidget): boolean {
    return other.glyph === this.glyph
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-bullet'
    span.textContent = this.glyph
    return span
  }
}

/** A task list checkbox. Clicks are handled by the editor, which toggles the task in the source. */
export class CheckboxWidget extends WidgetType {
  readonly checked: boolean

  constructor(checked: boolean) {
    super()
    this.checked = checked
  }

  override eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked
  }

  toDOM(): HTMLElement {
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.className = 'cm-taskCheckbox'
    checkbox.checked = this.checked
    checkbox.setAttribute('aria-label', 'Done')
    return checkbox
  }

  override ignoreEvent(): boolean {
    return false
  }
}

/** An image, shown below the line with its Markdown. */
export class ImageWidget extends WidgetType {
  readonly src: string
  readonly alt: string

  constructor(src: string, alt: string) {
    super()
    this.src = src
    this.alt = alt
  }

  override eq(other: ImageWidget): boolean {
    return other.src === this.src && other.alt === this.alt
  }

  toDOM(view: EditorView): HTMLElement {
    const figure = document.createElement('div')
    figure.className = 'cm-image'
    const image = figure.appendChild(imageElement(this.src, this.alt, view))
    image.addEventListener('error', () => {
      figure.hidden = true
      view.requestMeasure()
    })
    return figure
  }
}

/**
 * A rendered table, standing in for its source. Clicking a cell puts the cursor in that cell's
 * source, which shows the source; ⌘/Ctrl+click on a link opens it.
 */
export class TableWidget extends WidgetType {
  readonly table: Table
  /** Identifies the rendering, so that unchanged tables keep their DOM. */
  readonly key: string

  constructor(table: Table) {
    super()
    this.table = table
    this.key = JSON.stringify(table)
  }

  override eq(other: TableWidget): boolean {
    return other.key === this.key
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-table'
    const table = wrapper.appendChild(document.createElement('table'))
    const [header = [], ...body] = this.table.rows

    const addRow = (section: HTMLTableSectionElement, cells: TableCell[], tag: 'th' | 'td') => {
      const row = section.insertRow()
      this.table.align.forEach((align, column) => {
        const element = row.appendChild(document.createElement(tag))
        if (align) element.style.textAlign = align
        const cell = cells[column]
        if (!cell) return
        element.dataset.offset = String(cell.offset)
        element.append(...renderInline(cell.content, view))
      })
    }
    addRow(table.createTHead(), header, 'th')
    const tbody = table.createTBody()
    for (const cells of body) addRow(tbody, cells, 'td')

    wrapper.addEventListener('mousedown', (event) => {
      event.preventDefault()
      const target = event.target instanceof Element ? event.target : null
      if (event.metaKey || event.ctrlKey) {
        const link = target?.closest<HTMLElement>('.cm-link')
        if (openLink(link?.dataset.url)) return
      }
      const offset = Number(target?.closest<HTMLElement>('[data-offset]')?.dataset.offset ?? 0)
      view.dispatch({ selection: { anchor: view.posAtDOM(wrapper) + offset } })
      view.focus()
    })
    return wrapper
  }
}
