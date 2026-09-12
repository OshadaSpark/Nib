<script lang="ts">
  import {
    Compartment,
    EditorState,
    Text,
    type EditorSelection,
    type Extension,
  } from '@codemirror/state'
  import { EditorView } from '@codemirror/view'
  import { untrack } from 'svelte'
  import type { Attachment } from 'svelte/attachments'
  import { difference } from './difference'
  import { editorExtensions } from './extensions'

  interface Props {
    /**
     * The document. The editor owns it once created, and reports changes through `onchange`. A new
     * `doc` replaces the parts that differ, keeping the selection and undo history, as when a file
     * is reloaded; remount the editor to start afresh.
     */
    doc?: Text
    /** Language extensions, which can change while the editor is mounted. */
    language?: Extension
    /** Called with the new document after every change. */
    onchange?: (doc: Text) => void
    /** Called with the selection when the editor is created and whenever the selection changes. */
    onselect?: (selection: EditorSelection) => void
  }

  const { doc = Text.empty, language = [], onchange, onselect }: Props = $props()

  const languageCompartment = new Compartment()

  const mountEditor: Attachment<HTMLElement> = (parent) => {
    // Untracked so that the editor is created once rather than recreated when a prop changes.
    const state = untrack(() =>
      EditorState.create({
        doc,
        extensions: [
          editorExtensions,
          languageCompartment.of(language),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onchange?.(update.state.doc)
            if (update.selectionSet) onselect?.(update.state.selection)
          }),
        ],
      }),
    )
    const view = new EditorView({ state, parent })
    untrack(() => onselect?.(state.selection))
    view.focus()

    $effect(() => {
      if (!doc.eq(view.state.doc)) view.dispatch({ changes: difference(view.state.doc, doc) })
    })

    $effect(() => {
      if (language !== languageCompartment.get(view.state)) {
        view.dispatch({ effects: languageCompartment.reconfigure(language) })
      }
    })

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
