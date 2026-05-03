import { useMemo, useRef, useEffect } from 'react'
import { renderMarkdown } from '../../editor/markdown-renderer'
import { initMermaid, renderMermaidDiagrams } from '../../editor/mermaid-renderer'
import { themeService } from '../../services/theme-service'
import { updatePreviewContent } from '../../utils/dom-diff'
import katex from 'katex'
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

    renderMermaidDiagrams(previewRef.current).then(() => {
      renderMathInElement(previewRef.current!)
    })
  }, [html])

  return <div ref={previewRef} className="preview-pane markdown-body" />
}

function renderMathInElement(element: HTMLElement): void {
  // 跳过 code / pre 内部的公式（避免代码块内 $ 被误渲染）
  const isInsideCode = (node: Node): boolean => {
    let p = node.parentElement
    while (p) {
      if (p.tagName === 'CODE' || p.tagName === 'PRE') return true
      p = p.parentElement
    }
    return false
  }

  const textNodes: { node: Text; formula: string }[] = []
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (isInsideCode(node)) continue
    const text = node.textContent || ''

    const blockRegex = /\$\$([\s\S]*?)\$\$/g
    let match: RegExpExecArray | null
    while ((match = blockRegex.exec(text)) !== null) {
      try {
        const result = katex.renderToString(match[1].trim(), { displayMode: true, throwOnError: false })
        textNodes.push({ node, formula: result })
      } catch { /* ignore */ }
    }

    const inlineRegex = /(?<!\$)\$([^$\n]+?)\$(?!\$)/g
    while ((match = inlineRegex.exec(text)) !== null) {
      try {
        const result = katex.renderToString(match[1].trim(), { displayMode: false, throwOnError: false })
        textNodes.push({ node, formula: result })
      } catch { /* ignore */ }
    }
  }

  for (const item of textNodes) {
    const span = document.createElement('span')
    span.innerHTML = item.formula
    item.node.parentNode?.replaceChild(span, item.node)
  }
}

export default PreviewPane
