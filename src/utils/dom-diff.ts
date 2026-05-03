import morphdom from 'morphdom'

/**
 * 使用 morphdom 增量更新预览区，避免全量 innerHTML 替换
 * 跳过已渲染的 Mermaid SVG 和 KaTeX 容器，减少重复渲染
 */
export function updatePreviewContent(container: HTMLElement, newHtml: string): void {
  const temp = document.createElement('div')
  temp.innerHTML = newHtml

  morphdom(container, temp, {
    childrenOnly: true,
    onBeforeElUpdated: (fromEl, _toEl) => {
      if (fromEl.classList.contains('mermaid-rendered')) return false
      if (fromEl.tagName === 'SPAN' && fromEl.classList.contains('katex')) return false
      return true
    },
  })
}
