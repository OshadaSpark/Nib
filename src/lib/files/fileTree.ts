import { createContext } from 'svelte'
import type { DirectoryNode } from './folder.svelte'

/** What the lists of a file tree share, at every depth: its state, and actions on its entries. */
export interface FileTree {
  /** The path of the file shown in the editor, if it is in the folder. */
  readonly current: string | null
  /** The directory in which a new file is being named, if any. */
  readonly creatingIn: string | null
  /** The file being renamed, if any. */
  readonly renaming: string | null
  /** Whether the file at `path` has unsaved changes. */
  isDirty: (path: string) => boolean
  toggle: (directory: DirectoryNode) => void
  open: (path: string) => void
  create: (directory: string, name: string) => void
  startRename: (path: string) => void
  rename: (path: string, name: string) => void
  remove: (path: string) => void
  /** Ends creating or renaming without a change. */
  cancel: () => void
}

export const [getFileTree, setFileTree] = createContext<FileTree>()
