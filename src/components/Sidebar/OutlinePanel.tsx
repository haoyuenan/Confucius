import { useEffect, useCallback } from 'react'
import { EditorView } from 'codemirror'
import { useTranslation } from 'react-i18next'
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

  const handleJump = useCallback((from: number, _text: string, _idx: number, slug: string) => {
    const view = getActiveView()

    // 预览区跳转（在编辑器跳转之前执行，且不依赖 view）
    const previewEl = document.querySelector('.preview-pane')
    if (previewEl) {
      const target = previewEl.querySelector(`[id="${CSS.escape(slug)}"]`) as HTMLElement | null
      if (target) scrollPreviewToHeading(target)
    }

    // 编辑器跳转（仅在非纯预览模式时有 editorView）
    if (!view) return
    const pos = Math.min(from, view.state.doc.length)
    view.dispatch({
      effects: EditorView.scrollIntoView(pos, { y: 'start' }),
      selection: { anchor: pos },
    })
    requestAnimationFrame(() => {
      view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'start' }) })
      view.focus()
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
            onClick={() => handleJump(item.from, item.text, idx, item.slug)}
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
