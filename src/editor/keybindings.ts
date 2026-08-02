import { keymap, EditorView } from '@codemirror/view'
import * as fmt from './format-helpers'
import { SHORTCUTS, cm6Key } from '../config/shortcuts'

// 编辑器内快捷键与格式动作的映射（键定义见 src/config/shortcuts.ts）
const editorActionMap: Record<string, (view: EditorView) => boolean> = {
  'edit:bold': fmt.toggleBold,
  'edit:italic': fmt.toggleItalic,
  'edit:link': fmt.insertLink,
  'edit:inline-code': fmt.toggleInlineCode,
  'edit:code-block': fmt.insertCodeBlock,
  'edit:math': fmt.insertMathBlock,
  'edit:unordered-list': fmt.insertUnorderedList,
  'edit:blockquote': fmt.toggleBlockquote,
  'edit:ordered-list': fmt.insertOrderedList,
}

export const editorKeyBindings = keymap.of(
  SHORTCUTS.filter((s) => s.id in editorActionMap).map((s) => ({
    key: cm6Key(s.keys),
    run: editorActionMap[s.id],
  })),
)
