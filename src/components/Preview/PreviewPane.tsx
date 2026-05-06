import { useMemo, useRef, useEffect } from 'react'
import { EditorView } from 'codemirror'
import { renderMarkdown } from '../../editor/markdown-renderer'
import { initMermaid, renderMermaidDiagrams } from '../../editor/mermaid-renderer'
import { themeService } from '../../services/theme-service'
import { updatePreviewContent } from '../../utils/dom-diff'
import { useSidebarStore } from '../../stores/sidebar-store'
import { useEditorStore } from '../../stores/editor-store'
import { getActiveView } from '../../editor/active-view'
import 'katex/dist/katex.min.css'

interface PreviewPaneProps {
  content: string
}

/** 模块级预览滚动容器引用（供 sync-scroll 使用） */
let _previewScrollEl: HTMLElement | null = null
export function getPreviewScrollEl(): HTMLElement | null {
  return _previewScrollEl
}

function PreviewPane({ content }: PreviewPaneProps) {
  const previewRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)
  const html = useMemo(() => renderMarkdown(content), [content])
  const outlineItems = useSidebarStore((s) => s.outlineItems)

  // 点击预览区标题 → 编辑器跳转到对应位置；点击链接 → 系统浏览器打开
  useEffect(() => {
    const el = previewRef.current
    if (!el) return

    const handleClick = (e: MouseEvent) => {
      // 处理链接点击
      const anchor = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null
      if (anchor) {
        e.preventDefault()
        const href = anchor.getAttribute('href')
        if (!href) return
        if (/^https?:\/\//i.test(href)) {
          window.electronAPI.openExternal(href)
        } else if (href.startsWith('#')) {
          // 锚点跳转：滚动到预览区内对应 id 元素
          const targetId = decodeURIComponent(href.slice(1))
          const target = el.querySelector(`[id="${CSS.escape(targetId)}"]`)
          target?.scrollIntoView({ behavior: 'smooth' })
        }
        return
      }

      // 处理标题点击
      const heading = (e.target as HTMLElement).closest('h1, h2, h3, h4, h5, h6') as HTMLElement | null
      if (!heading) return

      const view = getActiveView()
      if (!view) return

      const headings = Array.from(el.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      const idx = headings.indexOf(heading)
      if (idx < 0 || idx >= outlineItems.length) return

      const pos = Math.min(outlineItems[idx].from, view.state.doc.length)
      view.dispatch({
        effects: EditorView.scrollIntoView(pos, { y: 'start' }),
        selection: { anchor: pos },
      })
      view.focus()

      // 等待 sync-scroll 可能干扰后重新确认编辑器位置
      requestAnimationFrame(() => {
        if (view) {
          view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'start' }) })
        }
      })
    }

    el.addEventListener('click', handleClick)
    return () => el.removeEventListener('click', handleClick)
  }, [outlineItems])

  useEffect(() => {
    window.__exportPreviewHTML__ = () => previewRef.current?.innerHTML || ''
    _previewScrollEl = previewRef.current
    return () => {
      delete window.__exportPreviewHTML__
      _previewScrollEl = null
    }
  }, [])

  useEffect(() => {
    const theme = themeService.getCurrentTheme()
    initMermaid(theme === 'dark' ? 'dark' : theme === 'sepia' ? 'neutral' : 'default')
  }, [])

  useEffect(() => {
    if (!previewRef.current) return

    if (isFirstRender.current) {
      previewRef.current.innerHTML = html
      isFirstRender.current = false
    } else {
      updatePreviewContent(previewRef.current, html)
    }

    // 大文件跳过 Mermaid 渲染（性能开销大）
    const isLarge = useEditorStore.getState().isLargeFile
    if (!isLarge) {
      renderMermaidDiagrams(previewRef.current)
    }
  }, [html])

  return <div ref={previewRef} className="preview-pane markdown-body" />
}

export default PreviewPane
