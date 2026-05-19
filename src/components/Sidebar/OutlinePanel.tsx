import { useEffect, useCallback } from 'react'
import { EditorView } from 'codemirror'
import { useTranslation } from '../../i18n/i18n-store'
import { useSidebarStore } from '../../stores/sidebar-store'
import { useEditorStore } from '../../stores/editor-store'
import { extractOutline, getOutlineIndent } from '../../editor/outline-parser'
import { getActiveView } from '../../editor/active-view'

/**
 * 将预览区滚动到指定标题元素位置（基于 getBoundingClientRect 计算 scrollTop）
 * 比 scrollIntoView 更可靠，避免父容器 overflow:hidden 的干扰
 */
function scrollPreviewToHeading(headingEl: HTMLElement): void {
  const previewEl = document.querySelector('.preview-pane')
  if (!previewEl) return
  const previewRect = previewEl.getBoundingClientRect()
  const headingRect = headingEl.getBoundingClientRect()
  previewEl.scrollTop += headingRect.top - previewRect.top
}

function OutlinePanel() {
  const { t } = useTranslation()
  const outlineItems = useSidebarStore((s) => s.outlineItems)
  const setOutlineItems = useSidebarStore((s) => s.setOutlineItems)
  const editorContent = useEditorStore((s) => s.content)

  useEffect(() => {
    const items = extractOutline(editorContent)
    setOutlineItems(items)
  }, [editorContent, setOutlineItems])

  const handleJump = useCallback((from: number, text: string, idx: number) => {
    const view = getActiveView()
    if (!view) return
    const pos = Math.min(from, view.state.doc.length)

    // 编辑器跳转（光标 + 滚动）
    view.dispatch({
      effects: EditorView.scrollIntoView(pos, { y: 'start' }),
      selection: { anchor: pos },
    })

    // 预览区跳转
    const previewEl = document.querySelector('.preview-pane')
    if (previewEl) {
      const headings = previewEl.querySelectorAll('h1, h2, h3, h4, h5, h6')
      let target = headings[idx] as HTMLElement | undefined
      // 索引匹配失败时回退到文本匹配
      if (!target) {
        for (const h of headings) {
          if (h.textContent?.trim() === text.trim()) { target = h as HTMLElement; break }
        }
      }
      if (target) scrollPreviewToHeading(target)
    }

    // 等 sync-scroll 可能干扰后重新确认编辑器位置
    requestAnimationFrame(() => {
      if (view) {
        view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'start' }) })
        view.focus()
      }
    })
  }, [])

  if (outlineItems.length === 0) {
    return (
      <div className="outline-panel">
        <div className="sidebar-empty">{t('sidebar.outline.empty')}</div>
      </div>
    )
  }

  return (
    <div className="outline-panel">
      <div className="outline-header">{t('sidebar.outline.header')}</div>
      <div className="outline-list">
        {outlineItems.map((item, idx) => (
          <div
            key={`${item.from}-${idx}`}
            className="outline-item"
            style={{ paddingLeft: getOutlineIndent(item.level) + 12 }}
            onClick={() => handleJump(item.from, item.text, idx)}
          >
            <span className={`outline-level h-${item.level}`}>H{item.level}</span>
            <span className="outline-text">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default OutlinePanel
