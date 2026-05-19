/**
 * 格式化函数集合
 * 快捷键 (keybindings.ts) 和工具栏 (FormatToolbar) 共用此模块
 * 函数均为纯 CM6 dispatch 操作，不依赖 React
 */
import { EditorView } from '@codemirror/view'
import { useI18nStore } from '../i18n/i18n-store'

/** 插入标题：在行首插入 # 标记 */
export function insertHeading(view: EditorView, level: 1 | 2 | 3): boolean {
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  const prefix = '#'.repeat(level) + ' '
  const existing = line.text.match(/^(#{1,6})\s/)
  if (existing) {
    view.dispatch({
      changes: { from: line.from, to: line.from + existing[0].length, insert: prefix },
    })
  } else {
    view.dispatch({
      changes: { from: line.from, insert: prefix },
      selection: { anchor: from + prefix.length },
    })
  }
  return true
}

/** 加粗（toggle） */
export function toggleBold(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const s = view.state.sliceDoc(from, to)
  if (s.startsWith('**') && s.endsWith('**') && s.length > 4) {
    const inner = s.slice(2, -2)
    view.dispatch({ changes: { from, to, insert: inner }, selection: { anchor: from, head: from + inner.length } })
  } else {
      view.dispatch({ changes: { from, to, insert: `**${s || useI18nStore.getState().t('editor.placeholder.bold')}**` }, selection: { anchor: from + 2, head: from + 2 + s.length } })
  }
  return true
}

/** 斜体（toggle） */
export function toggleItalic(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const s = view.state.sliceDoc(from, to)
  if (s.startsWith('*') && s.endsWith('*') && !s.startsWith('**') && s.length > 2) {
    const inner = s.slice(1, -1)
    view.dispatch({ changes: { from, to, insert: inner }, selection: { anchor: from, head: from + inner.length } })
  } else {
      view.dispatch({ changes: { from, to, insert: `*${s || useI18nStore.getState().t('editor.placeholder.italic')}*` }, selection: { anchor: from + 1, head: from + 1 + s.length } })
  }
  return true
}

/** 删除线（toggle） */
export function toggleStrikethrough(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const s = view.state.sliceDoc(from, to)
  if (s.startsWith('~~') && s.endsWith('~~') && s.length > 4) {
    const inner = s.slice(2, -2)
    view.dispatch({ changes: { from, to, insert: inner }, selection: { anchor: from, head: from + inner.length } })
  } else {
      view.dispatch({ changes: { from, to, insert: `~~${s || useI18nStore.getState().t('editor.placeholder.strikethrough')}~~` }, selection: { anchor: from + 2, head: from + 2 + s.length } })
  }
  return true
}

/** 引用（toggle） */
export function toggleBlockquote(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const s = view.state.sliceDoc(from, to)
  const lines = (s || useI18nStore.getState().t('editor.placeholder.quote')).split('\n')
  const allQuoted = lines.every(l => l.startsWith('> '))
  const result = allQuoted
    ? lines.map(l => l.slice(2)).join('\n')
    : lines.map(l => `> ${l}`).join('\n')
  view.dispatch({ changes: { from, to, insert: result } })
  return true
}

/** 代码块 */
export function insertCodeBlock(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const s = view.state.sliceDoc(from, to)
  const ins = s ? `\`\`\`\n${s}\n\`\`\`` : '```\n\n```'
  view.dispatch({ changes: { from, to, insert: ins } })
  return true
}

/** 行内代码 */
export function toggleInlineCode(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const s = view.state.sliceDoc(from, to)
  view.dispatch({
    changes: { from, to, insert: `\`${s || 'code'}\`` },
    selection: { anchor: from + 1, head: from + 1 + s.length },
  })
  return true
}

/** 无序列表 */
export function insertUnorderedList(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const s = view.state.sliceDoc(from, to)
  view.dispatch({ changes: { from, to, insert: (s || useI18nStore.getState().t('editor.placeholder.listItem')).split('\n').map(l => `- ${l}`).join('\n') } })
  return true
}

/** 有序列表 */
export function insertOrderedList(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const s = view.state.sliceDoc(from, to)
  view.dispatch({ changes: { from, to, insert: (s || useI18nStore.getState().t('editor.placeholder.listItem')).split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n') } })
  return true
}

/** 链接：插入 [text](url) 并选中 url 部分 */
export function insertLink(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const s = view.state.sliceDoc(from, to) || useI18nStore.getState().t('editor.placeholder.linkText')
  const inserted = `[${s}](url)`
  // inserted 的字符位置: 0:[  1:s  1+s:]  2+s:(  3+s:u  4+s:r  5+s:l  6+s:)
  const urlStart = from + s.length + 3
  const urlEnd = urlStart + 3
  view.dispatch({
    changes: { from, to, insert: inserted },
    selection: { anchor: urlStart, head: urlEnd },
  })
  return true
}

/** 图片 */
export function insertImage(view: EditorView): boolean {
  const t = useI18nStore.getState().t
  const { from } = view.state.selection.main
  view.dispatch({
    changes: { from, insert: `![${t('editor.placeholder.imageDesc')}](url)` },
    selection: { anchor: from + 7, head: from + 10 },
  })
  return true
}

/** 分割线 */
export function insertHorizontalRule(view: EditorView): boolean {
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  view.dispatch({ changes: { from: line.from, insert: '---\n' } })
  return true
}

/** 公式块 */
export function insertMathBlock(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const s = view.state.sliceDoc(from, to)
  const ins = s ? `$$\n${s}\n$$` : '$$\n\n$$'
  view.dispatch({ changes: { from, to, insert: ins } })
  return true
}

/** 粘贴 URL 时根据是否有选区自动转 Markdown 链接/图片 */
export function wrapSelectionAsLink(view: EditorView, url: string): boolean {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  if (selected && selected !== url) {
    const isImage = /\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$/i.test(url)
    const markdown = isImage ? `![${selected}](${url})` : `[${selected}](${url})`
    view.dispatch({
      changes: { from, to, insert: markdown },
      selection: { anchor: from + markdown.length },
    })
    return true
  }
  return false
}

/** 从图片文件路径插入 Markdown 图片语法（用于粘贴/拖拽） */
export function insertImageFromPath(view: EditorView, filePath: string, fileName: string): void {
  const { from } = view.state.selection.main
  const alt = fileName.replace(/\.[^.]+$/, '')
  const encodedPath = filePath.replace(/\\/g, '/').split('/').map(seg => encodeURIComponent(seg)).join('/')
  const markdown = `![${alt}](local-asset:///${encodedPath})`
  view.dispatch({
    changes: { from, insert: markdown },
    selection: { anchor: from + markdown.length },
  })
}

/** 插入 Markdown 表格模板 */
export function insertTable(view: EditorView, rows: number, cols: number): boolean {
  const { from } = view.state.selection.main

  // 计算每列宽度（最小 8 字符）
  const colWidths: number[] = []
  for (let c = 1; c <= cols; c++) {
    colWidths.push(Math.max(8, `Header ${c}`.length))
  }

  // 分隔线
  const sep = colWidths.map((w) => '-'.repeat(w)).join(' | ')

  // 表头行
  const header = colWidths.map((_, c) => {
    return `Header ${c + 1}`.padEnd(colWidths[c])
  }).join(' | ')

  // 数据行
  const bodyRows: string[] = []
  for (let r = 1; r <= rows; r++) {
    bodyRows.push(colWidths.map((w) => 'Cell'.padEnd(w)).join(' | '))
  }

  const table = `| ${header} |\n| ${sep} |\n| ${bodyRows.join(' |\n| ')} |\n`
  view.dispatch({
    changes: { from, insert: table },
    // 光标定位到第一个表头单元格，方便直接覆盖 "Header 1"
    selection: { anchor: from + 2 + 'Header 1'.length },
  })
  view.focus()
  return true
}
