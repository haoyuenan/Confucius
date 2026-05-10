import { undo, redo } from '@codemirror/commands'
import { getActiveView } from '../../editor/active-view'
import { useEditorStore } from '../../stores/editor-store'
import * as fmt from '../../editor/format-helpers'
import styles from './FormatToolbar.module.css'

interface ButtonDef {
  icon: string
  btnStyle?: string
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

const groups: { label: string; buttons: ButtonDef[] }[] = [
  {
    label: '撤销重做',
    buttons: [
      { icon: '↩', title: '撤销 (Ctrl+Z)', action: () => { const v = getActiveView(); if (v) { v.focus(); undo(v) } } },
      { icon: '↪', title: '重做 (Ctrl+Y)', action: () => { const v = getActiveView(); if (v) { v.focus(); redo(v) } } },
    ],
  },
  {
    label: '标题',
    buttons: [
      { icon: 'H₁', title: '一级标题 (Ctrl+1)', action: () => exec('heading', 1) },
      { icon: 'H₂', title: '二级标题 (Ctrl+2)', action: () => exec('heading', 2) },
      { icon: 'H₃', title: '三级标题 (Ctrl+3)', action: () => exec('heading', 3) },
    ],
  },
  {
    label: '行内',
    buttons: [
      { icon: 'B', btnStyle: styles.btnBold, title: '加粗 (Ctrl+B)', action: () => exec('bold') },
      { icon: 'I', btnStyle: styles.btnItalic, title: '斜体 (Ctrl+I)', action: () => exec('italic') },
      { icon: 'S', btnStyle: styles.btnStrike, title: '删除线', action: () => exec('strike') },
    ],
  },
  {
    label: '块级',
    buttons: [
      { icon: '❝', title: '引用 (Ctrl+Shift+[)', action: () => exec('quote') },
      { icon: '{ }', btnStyle: styles.btnCode, title: '代码块 (Ctrl+Shift+`)', action: () => exec('codeblock') },
      { icon: '`', title: '行内代码 (Ctrl+`)', action: () => exec('inlinecode') },
      { icon: '≡', title: '无序列表 (Ctrl+Shift+L)', action: () => exec('ullist') },
      { icon: '#', title: '有序列表 (Ctrl+Shift+O)', action: () => exec('ollist') },
    ],
  },
  {
    label: '插入',
    buttons: [
      { icon: '∑', title: '公式块 (Ctrl+Shift+M)', action: () => exec('mathblock') },
      { icon: '↗', title: '链接 (Ctrl+K)', action: () => exec('link') },
      { icon: '□', title: '图片', action: () => exec('image') },
      { icon: '—', title: '分割线', action: () => exec('hr') },
    ],
  },
  {
    label: '辅助',
    buttons: [
      { icon: '🎯', title: '专注模式 (F11)', action: () => useEditorStore.getState().toggleFocusMode() },
      { icon: '📝', title: '打字机模式 (F12)', action: () => useEditorStore.getState().toggleTypewriterMode() },
    ],
  },
]

function FormatToolbar() {
  const focusMode = useEditorStore((s) => s.focusMode)
  const typewriterMode = useEditorStore((s) => s.typewriterMode)

  return (
    <div className={styles.formatToolbar}>
      {groups.map((group, gi) => (
        <span key={group.label} className={styles.toolbarGroup}>
          {gi > 0 && <span className={styles.toolbarDivider} />}
          {group.buttons.map((btn) => {
            const isFocus = btn.icon === '🎯'
            const isTypewriter = btn.icon === '📝'
            const active = (isFocus && focusMode) || (isTypewriter && typewriterMode)
            return (
              <button
                key={btn.title}
                data-testid={`format-btn-${btn.icon}`}
                className={`${styles.toolbarBtn}${btn.btnStyle ? ` ${btn.btnStyle}` : ''}${active ? ` ${styles.active}` : ''}`}
                data-tooltip={btn.title}
                onClick={btn.action}
              >
                {btn.icon}
              </button>
            )
          })}
        </span>
      ))}
    </div>
  )
}

export default FormatToolbar
