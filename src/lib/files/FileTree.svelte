<script lang="ts">
  import FileTreeList from './FileTreeList.svelte'
  import { parentOf, type DirectoryNode, type Folder } from './folder.svelte'

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

  const ontoggle = (directory: DirectoryNode): void => {
    // Listing only fails if the directory went away, which the next refresh shows.
    folder.toggle(directory).catch((error: unknown) => {
      console.warn(error)
    })
  }

  /** Names a new file, beside the file shown in the editor or else at the top of the folder. */
  const startCreate = (): void => {
    renaming = null
    creatingIn = current === null ? '' : parentOf(current)
  }
  const onstartrename = (path: string): void => {
    creatingIn = null
    renaming = path
  }
  const oncancel = (): void => {
    creatingIn = null
    renaming = null
  }
  const create = (directory: string, name: string): void => {
    oncancel()
    oncreate(directory, name)
  }
  const rename = (path: string, name: string): void => {
    oncancel()
    onrename(path, name)
  }
</script>

<nav aria-label="Files">
  <div class="heading">
    <h2 title={folder.name}>{folder.name}</h2>
    <button type="button" aria-label="New file" title="New file" onclick={startCreate}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 3v10M3 8h10" />
      </svg>
    </button>
  </div>
  <FileTreeList
    directory={folder.root}
    {current}
    {isDirty}
    {creatingIn}
    {renaming}
    {ontoggle}
    {onopen}
    oncreate={create}
    {onstartrename}
    onrename={rename}
    {ondelete}
    {oncancel}
  />
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
    overflow: hidden;
    margin: 0;
    font-size: inherit;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  button {
    display: grid;
    padding: 0.375rem;
    color: var(--color-muted);

    & svg {
      inline-size: 1rem;
      block-size: 1rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
    }
  }
</style>
