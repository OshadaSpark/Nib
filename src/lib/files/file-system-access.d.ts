// File picker types from the File System Access API, which the DOM lib omits as only Chromium-based
// browsers implement it. The pickers are optional so that callers must check for support.
// https://wicg.github.io/file-system-access/#local-filesystem

interface FilePickerAcceptType {
  description?: string
  accept: Record<string, string | readonly string[]>
}

interface FilePickerOptions {
  types?: FilePickerAcceptType[]
  excludeAcceptAllOption?: boolean
}

interface SaveFilePickerOptions extends FilePickerOptions {
  suggestedName?: string
  /** Where the picker starts. */
  startIn?: FileSystemHandle
}

interface DirectoryPickerOptions {
  mode?: 'read' | 'readwrite'
}

interface Window {
  showOpenFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle[]>
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>
  showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>
}

// Renames the file in place. Chromium implements it, though only behind a flag for files outside the
// origin private file system: elsewhere it rejects.
interface FileSystemFileHandle {
  move?: (name: string) => Promise<void>
}

interface DataTransferItem {
  getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>
}
