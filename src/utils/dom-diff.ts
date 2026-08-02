import morphdom from 'morphdom'

/**
 * 使用 morphdom 增量更新预览区，避免全量 innerHTML 替换。
 *
 * 跳过规则（仅当目标内容确实未变时才跳过，源码变化必须重新渲染）：
 * - Mermaid SVG：pre 上记录的源码（data-mermaid-src）与目标源码一致时跳过
 * - KaTeX 容器：渲染 HTML 与目标一致时跳过
 * - 已加载 base64 的本地图片：引用路径未变时跳过，避免 src 被还原导致重复加载闪烁
 */
export function updatePreviewContent(container: HTMLElement, newHtml: string): void {
  const temp = document.createElement('div')
  temp.innerHTML = newHtml

  morphdom(container, temp, {
    childrenOnly: true,
    onBeforeElUpdated: (fromEl, toEl) => {
      if (fromEl.classList.contains('mermaid-rendered')) {
        const code = toEl.querySelector('code.language-mermaid')
        const src = code ? code.textContent ?? '' : ''
        return src !== (fromEl.dataset.mermaidSrc ?? '')
      }
      if (fromEl.tagName === 'SPAN' && fromEl.classList.contains('katex')) {
        return fromEl.innerHTML !== toEl.innerHTML
      }
      if (fromEl.tagName === 'IMG' && fromEl.dataset.b64Loaded) {
        const toSrc = toEl.getAttribute('src')
        return !(toSrc && fromEl.dataset.b64Src === toSrc.replace(/\\/g, '/'))
      }
      return true
    },
  })
}
