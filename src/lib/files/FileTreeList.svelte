<script lang="ts">
  import Icon from '$lib/ui/Icon.svelte'
  import { getFileTree } from './fileTree'
  import FileTreeList from './FileTreeList.svelte'
  import type { DirectoryNode, TreeNode } from './folder.svelte'
  import NameField from './NameField.svelte'

  interface Props {
    directory: DirectoryNode
  }

  const { directory }: Props = $props()

  const tree = getFileTree()

  const depth = (node: TreeNode | DirectoryNode): number =>
    node.path ? node.path.split('/').length : 0

  const create = (name: string): void => {
    tree.create(directory.path, name)
  }
  const renameTo =
    (path: string) =>
    (name: string): void => {
      tree.rename(path, name)
    }
</script>

<ul>
  {#if tree.creatingIn === directory.path}
    <li class="field" style:--depth={depth(directory)}>
      <NameField label="New file name" onsubmit={create} oncancel={tree.cancel} />
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
            tree.toggle(node)
          }}
        >
          <Icon name="chevron" />
          <span class="truncate">{node.name}</span>
        </button>
        {#if node.expanded}
          <FileTreeList directory={node} />
        {/if}
      {:else if tree.renaming === node.path}
        <div class="field" style:--depth={depth(node) - 1}>
          <NameField
            value={node.name}
            label="New name for {node.name}"
            onsubmit={renameTo(node.path)}
            oncancel={tree.cancel}
          />
        </div>
      {:else}
        <div class="file">
          <button
            type="button"
            class="row"
            style:--depth={depth(node) - 1}
            aria-current={node.path === tree.current ? 'page' : undefined}
            onclick={() => {
              tree.open(node.path)
            }}
          >
            <span class="truncate">{node.name}</span>
            {#if tree.isDirty(node.path)}
              <span class="edited"><span class="visually-hidden">(edited)</span></span>
            {/if}
          </button>
          <button
            type="button"
            class="action"
            aria-label="Rename {node.name}"
            title="Rename"
            onclick={() => {
              tree.startRename(node.path)
            }}
          >
            <Icon name="pencil" size="0.875rem" />
          </button>
          <button
            type="button"
            class="action"
            aria-label="Delete {node.name}"
            title="Delete"
            onclick={() => {
              tree.remove(node.path)
            }}
          >
            <Icon name="trash" size="0.875rem" />
          </button>
        </div>
      {/if}
    </li>
  {:else}
    {#if directory.path === '' && tree.creatingIn === null}
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
    padding-block: 0.3125rem;
    /* Indented by depth. */
    padding-inline: calc(0.25rem + var(--depth) * 1rem) 0.5rem;
    color: var(--color-subtle);
    text-align: start;

    &:hover {
      background: none;
    }

    /* Inside the row, as the sidebar clips what's beyond it. */
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
    padding-inline-start: calc(1.5rem + var(--depth) * 1rem);
  }

  .file {
    display: flex;
    align-items: center;
    padding-inline-end: 0.25rem;
    border-radius: 0.375rem;
    transition: background-color 0.15s;

    &:hover {
      background-color: var(--color-hover);
    }

    &:has([aria-current='page']) {
      background-color: var(--color-active);
    }

    & [aria-current='page'] {
      color: var(--color-text);
    }
  }

  .field {
    padding-block: 0.125rem;
    padding-inline-end: 0.25rem;
  }

  /* The chevron, pointing down while the directory is expanded. */
  [aria-expanded] > :global(svg) {
    color: var(--color-muted);
    transition: rotate 0.15s;
  }

  [aria-expanded='true'] > :global(svg) {
    rotate: 90deg;
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
  }

  .empty {
    padding: 0.25rem 0.5rem;
    color: var(--color-muted);
  }
</style>
