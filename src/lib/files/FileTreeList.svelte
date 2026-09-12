<script lang="ts">
  import FileTreeList from './FileTreeList.svelte'
  import type { DirectoryNode, TreeNode } from './folder.svelte'

  interface Props {
    directory: DirectoryNode
    /** The path of the file shown in the editor, if it is in the folder. */
    current: string | null
    isDirty: (path: string) => boolean
    ontoggle: (directory: DirectoryNode) => void
    onopen: (path: string) => void
  }

  const { directory, current, isDirty, ontoggle, onopen }: Props = $props()

  const depth = (node: TreeNode): number => node.path.split('/').length - 1
</script>

<ul>
  {#each directory.children ?? [] as node (node.path)}
    <li>
      {#if node.kind === 'directory'}
        <button
          type="button"
          class="row"
          style:--depth={depth(node)}
          aria-expanded={node.expanded}
          onclick={() => {
            ontoggle(node)
          }}
        >
          <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 4 4 4-4 4" />
          </svg>
          <span class="name">{node.name}</span>
        </button>
        {#if node.expanded}
          <FileTreeList directory={node} {current} {isDirty} {ontoggle} {onopen} />
        {/if}
      {:else}
        <button
          type="button"
          class="row file"
          style:--depth={depth(node)}
          aria-current={node.path === current ? 'page' : undefined}
          onclick={() => {
            onopen(node.path)
          }}
        >
          <span class="name">{node.name}</span>
          {#if isDirty(node.path)}
            <span class="edited"><span class="visually-hidden">(edited)</span></span>
          {/if}
        </button>
      {/if}
    </li>
  {:else}
    {#if directory.path === ''}
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
    align-items: center;
    gap: 0.25rem;
    inline-size: 100%;
    padding-block: 0.25rem;
    /* Indented by depth. */
    padding-inline: calc(0.5rem + var(--depth) * 1rem) 0.75rem;
    border-radius: 0;
    color: var(--color-muted);
    text-align: start;

    &:focus-visible {
      outline-offset: -2px;
    }
  }

  /* Files line up with the names of directories, after their chevron. */
  .file {
    padding-inline-start: calc(1.75rem + var(--depth) * 1rem);
  }

  [aria-current='page'] {
    color: var(--color-text);
    background-color: var(--color-hover);
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

  .empty {
    padding: 0.25rem 1rem;
    color: var(--color-muted);
  }
</style>
