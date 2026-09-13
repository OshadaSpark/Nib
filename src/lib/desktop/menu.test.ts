import { isTauri } from '@tauri-apps/api/core'
import { Menu, type MenuItemOptions } from '@tauri-apps/api/menu'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { menuItems, setAppMenu, type MenuCommands } from './menu'

vi.mock('@tauri-apps/api/core')

const commands = (): MenuCommands => ({
  newFile: vi.fn(),
  open: vi.fn(),
  openFolder: vi.fn(),
  save: vi.fn(),
  saveAs: vi.fn(),
  settings: vi.fn(),
})

/** The items of the menu titled `title`, with their texts, or `item` for the system's. */
const menu = (
  items: ReturnType<typeof menuItems>,
  title: string,
): (MenuItemOptions | { item: unknown })[] => {
  const found = items.find((item) => item.text === title)
  if (!found) throw new Error(`No ${title} menu`)
  return (found.items ?? []) as (MenuItemOptions | { item: unknown })[]
}

const texts = (items: (MenuItemOptions | { item: unknown })[]): unknown[] =>
  items.map((item) => ('text' in item ? item.text : item.item))

afterEach(() => {
  vi.resetAllMocks()
  vi.restoreAllMocks()
})

describe('menuItems', () => {
  it('runs the commands from the File menu, with their shortcuts', () => {
    const run = commands()
    const file = menu(menuItems(run), 'File')

    expect(texts(file)).toEqual([
      'New',
      'Open…',
      'Open Folder…',
      'Separator',
      'Save',
      'Save As…',
      'Separator',
      'CloseWindow',
    ])
    const save = file.find((item) => 'text' in item && item.text === 'Save') as MenuItemOptions
    expect(save.accelerator).toBe('CmdOrCtrl+S')
    save.action?.('save')
    expect(run.save).toHaveBeenCalledOnce()
  })

  it('leaves out Open Folder where folders can’t be opened', () => {
    const file = menu(menuItems({ ...commands(), openFolder: undefined }), 'File')
    expect(texts(file)).not.toContain('Open Folder…')
  })

  it('opens the settings from the app menu', () => {
    const run = commands()
    const settings = menu(menuItems(run), 'Nib').find(
      (item) => 'text' in item && item.text === 'Settings…',
    ) as MenuItemOptions

    settings.action?.('settings')

    expect(settings.accelerator).toBe('CmdOrCtrl+,')
    expect(run.settings).toHaveBeenCalledOnce()
  })

  it('edits through the system’s commands', () => {
    expect(texts(menu(menuItems(commands()), 'Edit'))).toEqual([
      'Undo',
      'Redo',
      'Separator',
      'Cut',
      'Copy',
      'Paste',
      'SelectAll',
    ])
  })
})

describe('setAppMenu', () => {
  it('sets the menu bar in the app', async () => {
    const setAsAppMenu = vi.fn()
    vi.mocked(isTauri).mockReturnValue(true)
    const newMenu = vi.spyOn(Menu, 'new').mockResolvedValue({ setAsAppMenu } as unknown as Menu)

    await setAppMenu(commands())

    expect(newMenu).toHaveBeenCalledOnce()
    expect(setAsAppMenu).toHaveBeenCalledOnce()
  })

  it('does nothing outside the app', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    const newMenu = vi.spyOn(Menu, 'new')

    await setAppMenu(commands())

    expect(newMenu).not.toHaveBeenCalled()
  })
})
