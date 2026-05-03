import { getActiveView } from '../../editor/active-view'
import * as fmt from '../../editor/format-helpers'

interface ButtonDef {
  icon: string
  style?: string
  title: string
  action: () => void
}

function exec(command: string, level?: number): void {
  const view = getActiveView()
  if (!view) return
  view.focus()
  switch (command) {
    case 'heading':    fmt.insertHeading(view, level as 1|2|3); break
    case 'bold':       fmt.toggleBold(view); break
    case 'italic':     fmt.toggleItalic(view); break
    case 'strike':     fmt.toggleStrikethrough(view); break
    case 'quote':      fmt.toggleBlockquote(view); break
    case 'codeblock':  fmt.insertCodeBlock(view); break
    case 'inlinecode': fmt.toggleInlineCode(view); break
    case 'ullist':     fmt.insertUnorderedList(view); break
    case 'ollist':     fmt.insertOrderedList(view); break
    case 'link':       fmt.insertLink(view); break
    case 'image':      fmt.insertImage(view); break
    case 'hr':         fmt.insertHorizontalRule(view); break
    case 'mathblock':  fmt.insertMathBlock(view); break
  }
}

const GROUPS: ButtonDef[][] = [
  // ── 标题 ──
  [
    { icon: 'H₁', title: '一级标题', action: () => exec('heading', 1) },
    { icon: 'H₂', title: '二级标题', action: () => exec('heading', 2) },
    { icon: 'H₃', title: '三级标题', action: () => exec('heading', 3) },
  ],
  // ── 行内格式 ──
  [
    { icon: 'B', style: 'btn-bold', title: '加粗 (Ctrl+B)', action: () => exec('bold') },
    { icon: 'I', style: 'btn-italic', title: '斜体 (Ctrl+I)', action: () => exec('italic') },
    { icon: 'S', style: 'btn-strike', title: '删除线', action: () => exec('strike') },
  ],
  // ── 块级格式 ──
  [
    { icon: '\u275D', title: '引用 (Ctrl+Shift+[)', action: () => exec('quote') },
    { icon: '{ }', title: '代码块 (Ctrl+Shift+`)', action: () => exec('codeblock'), style: 'btn-code' },
    { icon: '\u0060', title: '行内代码 (Ctrl+`)', action: () => exec('inlinecode') },
    { icon: '\u2261', title: '无序列表 (Ctrl+Shift+L)', action: () => exec('ullist') },
    { icon: '\u0023', title: '有序列表 (Ctrl+Shift+O)', action: () => exec('ollist') },
  ],
  // ── 插入 ──
  [
    { icon: '\u2211', title: '公式块 (Ctrl+Shift+M)', action: () => exec('mathblock') },
    { icon: '\u2197', title: '链接 (Ctrl+K)', action: () => exec('link') },
    { icon: '\u25A1', title: '图片', action: () => exec('image') },
    { icon: '\u2014', title: '分割线', action: () => exec('hr') },
  ],
]

function FormatToolbar() {
  return (
    <div className="format-toolbar">
      {GROUPS.map((group, gi) => (
        <span key={gi} className="toolbar-group">
          {gi > 0 && <span className="toolbar-divider" />}
          {group.map((btn, bi) => (
            <button
              key={bi}
              className={`toolbar-btn${btn.style ? ' ' + btn.style : ''}`}
              data-tooltip={btn.title}
              onClick={btn.action}
            >
              {btn.icon}
            </button>
          ))}
        </span>
      ))}
    </div>
  )
}

export default FormatToolbar
