import { isTauri } from '@tauri-apps/api/core'
import { Menu, type PredefinedMenuItemOptions, type SubmenuOptions } from '@tauri-apps/api/menu'

/** The commands of the menu bar that are the app's own, rather than the system's. */
export interface MenuCommands {
  newFile: () => void
  open: () => void
  /** Left out of the menu where folders can't be opened. */
  openFolder?: (() => void) | undefined
  save: () => void
  saveAs: () => void
  settings: () => void
}

const separator: PredefinedMenuItemOptions = { item: 'Separator' }

/**
 * The menu bar's menus: the app's own (the first, whatever its text), File, Edit and Window. Edit
 * has the system's commands: WKWebView only cuts, copies, pastes and selects all through them, and
 * CodeMirror undoes and redoes on the `beforeinput` events that Undo and Redo send.
 */
export const menuItems = (commands: MenuCommands): SubmenuOptions[] => [
  {
    text: 'Nib',
    items: [
      { item: { About: null } },
      separator,
      { text: 'Settings…', accelerator: 'CmdOrCtrl+,', action: commands.settings },
      separator,
      { item: 'Services' },
      separator,
      { item: 'Hide' },
      { item: 'HideOthers' },
      { item: 'ShowAll' },
      separator,
      { item: 'Quit' },
    ],
  },
  {
    text: 'File',
    items: [
      { text: 'New', accelerator: 'CmdOrCtrl+N', action: commands.newFile },
      { text: 'Open…', accelerator: 'CmdOrCtrl+O', action: commands.open },
      ...(commands.openFolder
        ? [{ text: 'Open Folder…', accelerator: 'CmdOrCtrl+Shift+O', action: commands.openFolder }]
        : []),
      separator,
      { text: 'Save', accelerator: 'CmdOrCtrl+S', action: commands.save },
      { text: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', action: commands.saveAs },
      separator,
      { item: 'CloseWindow' },
    ],
  },
  {
    text: 'Edit',
    items: [
      { item: 'Undo' },
      { item: 'Redo' },
      separator,
      { item: 'Cut' },
      { item: 'Copy' },
      { item: 'Paste' },
      { item: 'SelectAll' },
    ],
  },
  {
    text: 'Window',
    items: [{ item: 'Minimize' }, { item: 'Maximize' }, separator, { item: 'Fullscreen' }],
  },
]

/** Sets the menu bar to run `commands`. Outside the app, as in tests, there is no menu bar. */
export const setAppMenu = async (commands: MenuCommands): Promise<void> => {
  if (!isTauri()) return
  const menu = await Menu.new({ items: menuItems(commands) })
  await menu.setAsAppMenu()
}
