import { useState, useRef, useEffect } from 'react'
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
    case 'table':      break // handled inline via popup
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
      { icon: '⊞', title: '表格', action: () => exec('table') },
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

  const [showTablePopup, setShowTablePopup] = useState(false)
  const [tableCols, setTableCols] = useState(4)
  const [tableRows, setTableRows] = useState(3)
  const tableBtnRef = useRef<HTMLButtonElement>(null)
  const tablePopupRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭弹窗
  useEffect(() => {
    if (!showTablePopup) return
    const handler = (e: MouseEvent) => {
      if (
        tablePopupRef.current && !tablePopupRef.current.contains(e.target as Node) &&
        tableBtnRef.current && !tableBtnRef.current.contains(e.target as Node)
      ) {
        setShowTablePopup(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTablePopup])

  function insertTablePopup() {
    const view = getActiveView()
    if (!view) return
    fmt.insertTable(view, tableRows, tableCols)
    setShowTablePopup(false)
  }

  return (
    <div className={styles.formatToolbar}>
      {groups.map((group, gi) => {
        // 在 "插入" 分组外包裹一层，使表格按钮浮层定位正确
        const isInsertGroup = group.label === '插入'
        const inner = (
          <span key={group.label} className={styles.toolbarGroup}>
            {gi > 0 && <span className={styles.toolbarDivider} />}
            {group.buttons.map((btn) => {
              const isFocus = btn.icon === '🎯'
              const isTypewriter = btn.icon === '📝'
              const isTable = btn.icon === '⊞'
              const active = (isFocus && focusMode) || (isTypewriter && typewriterMode)
              return (
                <button
                  key={btn.title}
                  ref={isTable ? tableBtnRef : undefined}
                  data-testid={`format-btn-${btn.icon}`}
                  className={`${styles.toolbarBtn}${btn.btnStyle ? ` ${btn.btnStyle}` : ''}${active ? ` ${styles.active}` : ''}`}
                  data-tooltip={btn.title}
                  onClick={() => {
                    if (isTable) { setShowTablePopup((v) => !v); return }
                    btn.action()
                  }}
                >
                  {btn.icon}
                </button>
              )
            })}
          </span>
        )
        if (isInsertGroup) {
          return (
            <span key={group.label} className={styles.insertGroupWrapper}>
              {inner}
              {showTablePopup && (
                <div className={styles.tablePopup} ref={tablePopupRef}>
                  <div className={styles.tablePopupRow}>
                    <span>列:</span>
                    <button onClick={() => setTableCols(Math.max(1, tableCols - 1))}>−</button>
                    <span className={styles.tablePopupVal}>{tableCols}</span>
                    <button onClick={() => setTableCols(Math.min(8, tableCols + 1))}>+</button>
                  </div>
                  <div className={styles.tablePopupRow}>
                    <span>行:</span>
                    <button onClick={() => setTableRows(Math.max(1, tableRows - 1))}>−</button>
                    <span className={styles.tablePopupVal}>{tableRows}</span>
                    <button onClick={() => setTableRows(Math.min(10, tableRows + 1))}>+</button>
                  </div>
                  <div className={styles.tablePopupPreview}>
                    {tableRows} 行 × {tableCols} 列
                  </div>
                  <button className={styles.tablePopupInsert} onClick={insertTablePopup}>
                    插入表格
                  </button>
                </div>
              )}
            </span>
          )
        }
        return inner
      })}
    </div>
  )
}

export default FormatToolbar
