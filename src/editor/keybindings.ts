import { keymap, EditorView } from '@codemirror/view'
import * as fmt from './format-helpers'

export const editorKeyBindings = keymap.of([
  { key: 'Mod-b', run: (v: EditorView) => fmt.toggleBold(v) },
  { key: 'Mod-i', run: (v: EditorView) => fmt.toggleItalic(v) },
  { key: 'Mod-k', run: (v: EditorView) => fmt.insertLink(v) },
  { key: 'Mod-`', run: (v: EditorView) => fmt.toggleInlineCode(v) },
  { key: 'Mod-Shift-`', run: (v: EditorView) => fmt.insertCodeBlock(v) },
  { key: 'Mod-Shift-m', run: (v: EditorView) => fmt.insertMathBlock(v) },
  { key: 'Mod-Shift-l', run: (v: EditorView) => fmt.insertUnorderedList(v) },
  { key: 'Mod-Shift-[', run: (v: EditorView) => fmt.toggleBlockquote(v) },
  { key: 'Mod-Shift-o', run: (v: EditorView) => fmt.insertOrderedList(v) },
])
