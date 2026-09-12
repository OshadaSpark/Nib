<script lang="ts">
  import { historyField } from '@codemirror/commands'
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
  import type { EditorSnapshot } from './snapshot'
  import { appearanceTheme, type Appearance } from './theme'

  interface Props {
    /**
     * The document. The editor owns it once created, and reports changes through `onchange`. A new
     * `doc` replaces the parts that differ, keeping the selection and undo history, as when a file
     * is reloaded; remount the editor to start afresh.
     */
    doc?: Text
    /** Language extensions, which can change while the editor is mounted. */
    language?: Extension
    /** More extensions, fixed once the editor is created. */
    extensions?: Extension
    /** The text's font family, size and column width, which can change while mounted. */
    appearance?: Appearance | null
    /** Called with the new document after every change. */
    onchange?: (doc: Text) => void
    /** Called with the selection when the editor is created and whenever the selection changes. */
    onselect?: (selection: EditorSelection) => void
    /** State to start from instead of `doc`, as the editor last had it before `onleave`. */
    snapshot?: EditorSnapshot | null
    /** Called with the editor's state as it is unmounted, to restore it through `snapshot`. */
    onleave?: (snapshot: EditorSnapshot) => void
  }

  const {
    doc = Text.empty,
    language = [],
    extensions: extra = [],
    appearance = null,
    onchange,
    onselect,
    snapshot = null,
    onleave,
  }: Props = $props()

  // Undo history is part of the state only through its field.
  const fields = { history: historyField }

  const languageCompartment = new Compartment()
  const appearanceCompartment = new Compartment()

  const appearanceExtension = (value: Appearance | null): Extension =>
    value ? appearanceTheme(value) : []

  const mountEditor: Attachment<HTMLElement> = (parent) => {
    const extensions = [
      editorExtensions,
      untrack(() => extra),
      languageCompartment.of(untrack(() => language)),
      appearanceCompartment.of(untrack(() => appearanceExtension(appearance))),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onchange?.(update.state.doc)
        if (update.selectionSet) onselect?.(update.state.selection)
      }),
    ]
    // Untracked so that the editor is created once rather than recreated when a prop changes.
    const { initial, restored, leave } = untrack(() => ({
      initial: doc,
      restored: snapshot,
      // Taken now, for the file shown now: by the time the editor is unmounted, it may differ.
      leave: onleave,
    }))
    const state = restored
      ? EditorState.fromJSON(restored.state, { extensions }, fields)
      : EditorState.create({ doc: initial, extensions })
    const view = new EditorView({ state, parent })
    if (restored) view.dispatch({ effects: restored.scroll })
    untrack(() => onselect?.(state.selection))
    view.focus()

    // A new `doc`, as when the file is reloaded from disk, rather than the one the editor started
    // from, which a snapshot's document may have moved on from.
    let shown = initial
    $effect(() => {
      if (doc === shown) return
      shown = doc
      if (!doc.eq(view.state.doc)) view.dispatch({ changes: difference(view.state.doc, doc) })
    })

    // Skips the first run, as the editor starts with the appearance.
    let appeared = untrack(() => appearance)
    $effect(() => {
      if (appearance === appeared) return
      appeared = appearance
      view.dispatch({ effects: appearanceCompartment.reconfigure(appearanceExtension(appearance)) })
    })

    $effect(() => {
      if (language !== languageCompartment.get(view.state)) {
        view.dispatch({ effects: languageCompartment.reconfigure(language) })
      }
    })

    return () => {
      leave?.({ state: view.state.toJSON(fields), scroll: view.scrollSnapshot() })
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
