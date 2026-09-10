<script lang="ts">
  import { EditorState } from '@codemirror/state'
  import { EditorView } from '@codemirror/view'
  import { untrack } from 'svelte'
  import type { Attachment } from 'svelte/attachments'
  import { editorExtensions } from './extensions'

  interface Props {
    /** Initial document content. The editor owns the document afterwards. */
    doc?: string
  }

  const { doc = '' }: Props = $props()

  const mountEditor: Attachment<HTMLElement> = (parent) => {
    // Untracked so that the editor is created once rather than recreated when `doc` changes.
    const state = EditorState.create({ doc: untrack(() => doc), extensions: editorExtensions })
    const view = new EditorView({ state, parent })
    view.focus()

    return () => {
      view.destroy()
    }
  }
</script>

<div class="editor" {@attach mountEditor}></div>

<style>
  .editor {
    height: 100%;
  }
</style>
