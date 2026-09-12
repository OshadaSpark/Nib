<script lang="ts">
  import FileTreeList from './FileTreeList.svelte'
  import type { DirectoryNode, Folder } from './folder.svelte'

  interface Props {
    folder: Folder
    /** The path of the file shown in the editor, if it is in the folder. */
    current: string | null
    /** Whether the file at `path` has unsaved changes. */
    isDirty: (path: string) => boolean
    onopen: (path: string) => void
  }

  const { folder, current, isDirty, onopen }: Props = $props()

  const ontoggle = (directory: DirectoryNode): void => {
    // Listing only fails if the directory went away, which the next refresh shows.
    folder.toggle(directory).catch((error: unknown) => {
      console.warn(error)
    })
  }
</script>

<nav aria-label="Files">
  <h2 title={folder.name}>{folder.name}</h2>
  <FileTreeList directory={folder.root} {current} {isDirty} {ontoggle} {onopen} />
</nav>

<style>
  nav {
    padding-block: 0.5rem 1rem;
    font-size: 0.875rem;
  }

  h2 {
    overflow: hidden;
    margin: 0;
    padding: 0.25rem 1rem 0.5rem;
    font-size: inherit;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
