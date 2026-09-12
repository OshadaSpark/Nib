<script lang="ts">
  import Icon from '$lib/ui/Icon.svelte'
  import { setFileTree } from './fileTree'
  import FileTreeList from './FileTreeList.svelte'
  import type { Folder } from './folder.svelte'
  import { parentOf } from './paths'

  interface Props {
    folder: Folder
    /** The path of the file shown in the editor, if it is in the folder. */
    current: string | null
    /** Whether the file at `path` has unsaved changes. */
    isDirty: (path: string) => boolean
    onopen: (path: string) => void
    oncreate: (directory: string, name: string) => void
    onrename: (path: string, name: string) => void
    ondelete: (path: string) => void
  }

  const { folder, current, isDirty, onopen, oncreate, onrename, ondelete }: Props = $props()

  let creatingIn: string | null = $state(null)
  let renaming: string | null = $state(null)

  const cancel = (): void => {
    creatingIn = null
    renaming = null
  }

  /** Names a new file, beside the file shown in the editor or else at the top of the folder. */
  const startCreate = (): void => {
    renaming = null
    creatingIn = current === null ? '' : parentOf(current)
  }

  setFileTree({
    get current() {
      return current
    },
    get creatingIn() {
      return creatingIn
    },
    get renaming() {
      return renaming
    },
    isDirty: (path) => isDirty(path),
    toggle: (directory) => {
      // Listing only fails if the directory went away, which the next refresh shows.
      folder.toggle(directory).catch((error: unknown) => {
        console.warn(error)
      })
    },
    open: (path) => {
      onopen(path)
    },
    create: (directory, name) => {
      cancel()
      oncreate(directory, name)
    },
    startRename: (path) => {
      creatingIn = null
      renaming = path
    },
    rename: (path, name) => {
      cancel()
      onrename(path, name)
    },
    remove: (path) => {
      ondelete(path)
    },
    cancel,
  })
</script>

<nav aria-label="Files">
  <div class="heading">
    <h2 class="truncate" title={folder.name}>{folder.name}</h2>
    <button type="button" aria-label="New file" title="New file" onclick={startCreate}>
      <Icon name="plus" />
    </button>
  </div>
  <FileTreeList directory={folder.root} />
</nav>

<style>
  nav {
    padding-block: 0.5rem 1rem;
    font-size: 0.875rem;
  }

  .heading {
    display: flex;
    align-items: center;
    padding-block: 0 0.25rem;
    padding-inline: 1rem 0.25rem;
  }

  h2 {
    flex: 1;
    margin: 0;
    font-size: inherit;
    font-weight: 600;
  }

  button {
    padding: 0.375rem;
    color: var(--color-muted);
  }
</style>
