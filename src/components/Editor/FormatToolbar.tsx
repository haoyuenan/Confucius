import { useState, useRef, useEffect } from 'react'
import { undo, redo } from '@codemirror/commands'
import { getActiveView } from '../../editor/active-view'
import { useEditorStore } from '../../stores/editor-store'
import * as fmt from '../../editor/format-helpers'
import { useTranslation } from 'react-i18next'
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

function FormatToolbar() {
  const t = useTranslation().t
  const focusMode = useEditorStore((s) => s.focusMode)
  const typewriterMode = useEditorStore((s) => s.typewriterMode)

  const groups: { label: string; buttons: ButtonDef[] }[] = [
    {
      label: t('editor.format.groupUndo'),
      buttons: [
        { icon: '↩', title: t('editor.format.undo'), action: () => { const v = getActiveView(); if (v) { v.focus(); undo(v) } } },
        { icon: '↪', title: t('editor.format.redo'), action: () => { const v = getActiveView(); if (v) { v.focus(); redo(v) } } },
      ],
    },
    {
      label: t('editor.format.groupHeading'),
      buttons: [
        { icon: 'H₁', title: t('editor.format.heading1'), action: () => exec('heading', 1) },
        { icon: 'H₂', title: t('editor.format.heading2'), action: () => exec('heading', 2) },
        { icon: 'H₃', title: t('editor.format.heading3'), action: () => exec('heading', 3) },
      ],
    },
    {
      label: t('editor.format.groupInline'),
      buttons: [
        { icon: 'B', btnStyle: styles.btnBold, title: t('editor.format.bold'), action: () => exec('bold') },
        { icon: 'I', btnStyle: styles.btnItalic, title: t('editor.format.italic'), action: () => exec('italic') },
        { icon: 'S', btnStyle: styles.btnStrike, title: t('editor.format.strikethrough'), action: () => exec('strike') },
      ],
    },
    {
      label: t('editor.format.groupBlock'),
      buttons: [
        { icon: '❝', title: t('editor.format.quote'), action: () => exec('quote') },
        { icon: '{ }', btnStyle: styles.btnCode, title: t('editor.format.codeBlock'), action: () => exec('codeblock') },
        { icon: '`', title: t('editor.format.inlineCode'), action: () => exec('inlinecode') },
        { icon: '≡', title: t('editor.format.unorderedList'), action: () => exec('ullist') },
        { icon: '#', title: t('editor.format.orderedList'), action: () => exec('ollist') },
      ],
    },
    {
      label: t('editor.format.groupInsert'),
      buttons: [
        { icon: '∑', title: t('editor.format.mathBlock'), action: () => exec('mathblock') },
        { icon: '⊞', title: t('editor.format.table'), action: () => exec('table') },
        { icon: '↗', title: t('editor.format.link'), action: () => exec('link') },
        { icon: '□', title: t('editor.format.image'), action: () => exec('image') },
        { icon: '—', title: t('editor.format.hr'), action: () => exec('hr') },
      ],
    },
    {
      label: t('editor.format.groupAux'),
      buttons: [
        { icon: '🎯', title: t('editor.format.focus'), action: () => useEditorStore.getState().toggleFocusMode() },
        { icon: '📝', title: t('editor.format.typewriter'), action: () => useEditorStore.getState().toggleTypewriterMode() },
      ],
    },
  ]

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
        const isInsertGroup = group.buttons.some((b) => b.icon === '⊞')
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
                      <span>{t('editor.table.cols')}</span>
                      <button onClick={() => setTableCols(Math.max(1, tableCols - 1))}>−</button>
                      <span className={styles.tablePopupVal}>{tableCols}</span>
                      <button onClick={() => setTableCols(Math.min(8, tableCols + 1))}>+</button>
                    </div>
                    <div className={styles.tablePopupRow}>
                      <span>{t('editor.table.rows')}</span>
                      <button onClick={() => setTableRows(Math.max(1, tableRows - 1))}>−</button>
                      <span className={styles.tablePopupVal}>{tableRows}</span>
                      <button onClick={() => setTableRows(Math.min(10, tableRows + 1))}>+</button>
                    </div>
                    <div className={styles.tablePopupPreview}>
                      {t('editor.table.preview', { rows: tableRows, cols: tableCols })}
                    </div>
                  <button className={styles.tablePopupInsert} onClick={insertTablePopup}>
                    {t('editor.format.insertTable')}
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
