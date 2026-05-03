import { useMemo, useRef, useEffect } from 'react'
import { renderMarkdown } from '../../editor/markdown-renderer'
import { initMermaid, renderMermaidDiagrams } from '../../editor/mermaid-renderer'
import { themeService } from '../../services/theme-service'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface PreviewPaneProps {
  content: string
}

function PreviewPane({ content }: PreviewPaneProps) {
  const previewRef = useRef<HTMLDivElement>(null)
  const html = useMemo(() => renderMarkdown(content), [content])

  // 注册导出函数
  useEffect(() => {
    ;(window as any).__exportPreviewHTML__ = () => {
      return previewRef.current?.innerHTML || ''
    }
    return () => {
      delete (window as any).__exportPreviewHTML__
    }
  }, [])

  // 初始化 Mermaid（仅一次）
  useEffect(() => {
    const theme = themeService.getCurrentTheme()
    initMermaid(theme === 'dark' ? 'dark' : theme === 'sepia' ? 'neutral' : 'default')
  }, [])

  // 每次 HTML 更新后渲染预览
  useEffect(() => {
    if (!previewRef.current) return
    previewRef.current.innerHTML = html

    // 先渲染 Mermaid 图表
    renderMermaidDiagrams(previewRef.current).then(() => {
      // 再渲染 KaTeX 公式
      renderMathInElement(previewRef.current!)
    })
  }, [html])

  return <div ref={previewRef} className="preview-pane markdown-body" />
}

/**
 * 遍历 DOM 渲染 $...$ 和 $$...$$ 公式
 */
function renderMathInElement(element: HTMLElement): void {
  const textNodes: { node: Text; formula: string }[] = []

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const text = node.textContent || ''

    const blockRegex = /\$\$([\s\S]*?)\$\$/g
    let match: RegExpExecArray | null
    while ((match = blockRegex.exec(text)) !== null) {
      try {
        const result = katex.renderToString(match[1].trim(), {
          displayMode: true,
          throwOnError: false,
        })
        textNodes.push({ node, formula: result })
      } catch {
        // 忽略
      }
    }

    const inlineRegex = /(?<!\$)\$([^$\n]+?)\$(?!\$)/g
    while ((match = inlineRegex.exec(text)) !== null) {
      try {
        const result = katex.renderToString(match[1].trim(), {
          displayMode: false,
          throwOnError: false,
        })
        textNodes.push({ node, formula: result })
      } catch {
        // 忽略
      }
    }
  }

  for (const item of textNodes) {
    const span = document.createElement('span')
    span.innerHTML = item.formula
    item.node.parentNode?.replaceChild(span, item.node)
  }
}

export default PreviewPane
