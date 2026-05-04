import { useMemo, useRef, useEffect } from 'react'
import { renderMarkdown } from '../../editor/markdown-renderer'
import { initMermaid, renderMermaidDiagrams } from '../../editor/mermaid-renderer'
import { themeService } from '../../services/theme-service'
import { updatePreviewContent } from '../../utils/dom-diff'
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

    // 首次或全量用 innerHTML，后续用 morphdom 增量更新
    if (isFirstRender.current) {
      previewRef.current.innerHTML = html
      isFirstRender.current = false
    } else {
      updatePreviewContent(previewRef.current, html)
    }

    // 公式已在 markdown-it-texmath 层渲染，仅渲染 Mermaid 图表
    renderMermaidDiagrams(previewRef.current)
  }, [html])

  return <div ref={previewRef} className="preview-pane markdown-body" />
}

export default PreviewPane
