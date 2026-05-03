import { keymap } from '@codemirror/view'
import { EditorView } from '@codemirror/view'

/** 加粗：**text** */
const bold = {
  key: 'Mod-b',
  run: (view: EditorView): boolean => {
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    view.dispatch({
      changes: { from, to, insert: `**${selected || '粗体'}**` },
      selection: { anchor: from + 2, head: from + 2 + selected.length },
    })
    return true
  },
}

/** 斜体：*text* */
const italic = {
  key: 'Mod-i',
  run: (view: EditorView): boolean => {
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    view.dispatch({
      changes: { from, to, insert: `*${selected || '斜体'}*` },
      selection: { anchor: from + 1, head: from + 1 + selected.length },
    })
    return true
  },
}

/** 插入链接：[text](url) */
const link = {
  key: 'Mod-k',
  run: (view: EditorView): boolean => {
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const linkText = selected || '链接文本'
    view.dispatch({
      changes: { from, to, insert: `[${linkText}](url)` },
      selection: { anchor: from, head: from + linkText.length + 7 }, // 选中 url
    })
    return true
  },
}

/** 行内代码：`code` */
const inlineCode = {
  key: 'Mod-`',
  run: (view: EditorView): boolean => {
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    view.dispatch({
      changes: { from, to, insert: `\`${selected || 'code'}\`` },
      selection: { anchor: from + 1, head: from + 1 + selected.length },
    })
    return true
  },
}

/** 代码块：```\ncode\n``` */
const codeBlock = {
  key: 'Mod-Shift-`',
  run: (view: EditorView): boolean => {
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const insertion = selected
      ? `\`\`\`\n${selected}\n\`\`\``
      : '```\n\n```'
    view.dispatch({
      changes: { from, to, insert: insertion },
      selection: { anchor: from + 4, head: from + 4 + selected.length },
    })
    return true
  },
}

/** 公式块：$$\nformula\n$$ */
const mathBlock = {
  key: 'Mod-Shift-m',
  run: (view: EditorView): boolean => {
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const insertion = selected
      ? `$$\n${selected}\n$$`
      : '$$\n\n$$'
    view.dispatch({
      changes: { from, to, insert: insertion },
      selection: { anchor: from + 3, head: from + 3 + selected.length },
    })
    return true
  },
}

/** 无序列表 */
const unorderedList = {
  key: 'Mod-Shift-l',
  run: (view: EditorView): boolean => {
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const lines = (selected || '列表项').split('\n')
    const listText = lines.map((l) => `- ${l}`).join('\n')
    view.dispatch({
      changes: { from, to, insert: listText },
    })
    return true
  },
}

/** 引用 */
const blockquote = {
  key: 'Mod-Shift-[',
  run: (view: EditorView): boolean => {
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const lines = (selected || '引用').split('\n')
    const quoteText = lines.map((l) => `> ${l}`).join('\n')
    view.dispatch({
      changes: { from, to, insert: quoteText },
    })
    return true
  },
}

/** 有序列表 */
const orderedList = {
  key: 'Mod-Shift-o',
  run: (view: EditorView): boolean => {
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const lines = (selected || '列表项').split('\n')
    const listText = lines.map((l, i) => `${i + 1}. ${l}`).join('\n')
    view.dispatch({
      changes: { from, to, insert: listText },
    })
    return true
  },
}

export const editorKeyBindings = keymap.of([
  bold,
  italic,
  link,
  inlineCode,
  codeBlock,
  mathBlock,
  unorderedList,
  blockquote,
  orderedList,
])
