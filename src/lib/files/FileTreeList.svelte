<script lang="ts">
  import FileTreeList from './FileTreeList.svelte'
  import type { DirectoryNode, TreeNode } from './folder.svelte'
  import NameField from './NameField.svelte'

  interface Props {
    directory: DirectoryNode
    /** The path of the file shown in the editor, if it is in the folder. */
    current: string | null
    isDirty: (path: string) => boolean
    /** The directory in which a new file is being named, if any. */
    creatingIn: string | null
    /** The file being renamed, if any. */
    renaming: string | null
    ontoggle: (directory: DirectoryNode) => void
    onopen: (path: string) => void
    oncreate: (directory: string, name: string) => void
    onstartrename: (path: string) => void
    onrename: (path: string, name: string) => void
    ondelete: (path: string) => void
    /** Ends creating or renaming without a change. */
    oncancel: () => void
  }

  const props: Props = $props()
  const { directory, current, isDirty, creatingIn, renaming } = $derived(props)

  const depth = (node: TreeNode | DirectoryNode): number =>
    node.path ? node.path.split('/').length : 0

  const create = (name: string): void => {
    props.oncreate(directory.path, name)
  }
  const renameTo =
    (path: string) =>
    (name: string): void => {
      props.onrename(path, name)
    }
</script>

<ul>
  {#if creatingIn === directory.path}
    <li class="field" style:--depth={depth(directory)}>
      <NameField label="New file name" onsubmit={create} oncancel={props.oncancel} />
    </li>
  {/if}
  {#each directory.children ?? [] as node (node.path)}
    <li>
      {#if node.kind === 'directory'}
        <button
          type="button"
          class="row"
          style:--depth={depth(node) - 1}
          aria-expanded={node.expanded}
          onclick={() => {
            props.ontoggle(node)
          }}
        >
          <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 4 4 4-4 4" />
          </svg>
          <span class="name">{node.name}</span>
        </button>
        {#if node.expanded}
          <FileTreeList {...props} directory={node} />
        {/if}
      {:else if renaming === node.path}
        <div class="field" style:--depth={depth(node) - 1}>
          <NameField
            value={node.name}
            label="New name for {node.name}"
            onsubmit={renameTo(node.path)}
            oncancel={props.oncancel}
          />
        </div>
      {:else}
        <div class="file">
          <button
            type="button"
            class="row"
            style:--depth={depth(node) - 1}
            aria-current={node.path === current ? 'page' : undefined}
            onclick={() => {
              props.onopen(node.path)
            }}
          >
            <span class="name">{node.name}</span>
            {#if isDirty(node.path)}
              <span class="edited"><span class="visually-hidden">(edited)</span></span>
            {/if}
          </button>
          <button
            type="button"
            class="action"
            aria-label="Rename {node.name}"
            title="Rename"
            onclick={() => {
              props.onstartrename(node.path)
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10.5 2.5 13.5 5.5 6 13H3v-3z" />
            </svg>
          </button>
          <button
            type="button"
            class="action"
            aria-label="Delete {node.name}"
            title="Delete"
            onclick={() => {
              props.ondelete(node.path)
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.75 8.5h6.5L12 4.5" />
            </svg>
          </button>
        </div>
      {/if}
    </li>
  {:else}
    {#if directory.path === '' && creatingIn === null}
      <li class="empty">No Markdown or text files</li>
    {/if}
  {/each}
</ul>

<style>
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 0.25rem;
    min-inline-size: 0;
    padding-block: 0.25rem;
    /* Indented by depth. */
    padding-inline: calc(0.5rem + var(--depth) * 1rem) 0.75rem;
    border-radius: 0;
    color: var(--color-muted);
    text-align: start;

    &:hover {
      background: none;
    }

    &:focus-visible {
      outline-offset: -2px;
    }
  }

  button.row[aria-expanded] {
    inline-size: 100%;

    &:hover {
      background-color: var(--color-hover);
    }
  }

  /* Files line up with the names of directories, after their chevron. */
  .file .row,
  .field {
    padding-inline-start: calc(1.75rem + var(--depth) * 1rem);
  }

  .file {
    display: flex;
    align-items: center;
    padding-inline-end: 0.25rem;

    &:hover {
      background-color: var(--color-hover);
    }

    &:has([aria-current='page']) {
      background-color: var(--color-hover);
    }

    & [aria-current='page'] {
      color: var(--color-text);
    }
  }

  .field {
    padding-block: 0.125rem;
    padding-inline-end: 0.5rem;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chevron {
    flex: none;
    inline-size: 1rem;
    block-size: 1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: rotate 0.15s;

    [aria-expanded='true'] > & {
      rotate: 90deg;
    }
  }

  .edited {
    flex: none;
    inline-size: 0.4375rem;
    block-size: 0.4375rem;
    margin-inline-start: auto;
    border-radius: 50%;
    background-color: var(--color-accent);
  }

  /*
   * Shown on hover, or always where there is no hover. Focusing the file shows them too, so that
   * they come next when tabbing.
   */
  .action {
    flex: none;
    display: none;
    padding: 0.25rem;
    color: var(--color-muted);

    .file:hover &,
    .file:focus-within & {
      display: grid;
    }

    @media (hover: none) {
      display: grid;
    }

    & svg {
      inline-size: 0.875rem;
      block-size: 0.875rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.25;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  }

  .empty {
    padding: 0.25rem 1rem;
    color: var(--color-muted);
  }
</style>
