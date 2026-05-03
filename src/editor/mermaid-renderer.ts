import mermaid from 'mermaid'

/** 初始化 Mermaid */
export function initMermaid(theme: 'default' | 'dark' | 'neutral' = 'default'): void {
  mermaid.initialize({
    startOnLoad: false,
    theme,
    securityLevel: 'loose',
    fontFamily: 'sans-serif',
  })

  // 保存引用供主题服务联动
  ;(window as any).mermaidRef = mermaid
}

/**
 * 在容器 DOM 中查找并渲染所有 mermaid 图表
 */
export async function renderMermaidDiagrams(container: HTMLElement): Promise<void> {
  const codeBlocks = container.querySelectorAll<HTMLElement>('code.language-mermaid')
  if (codeBlocks.length === 0) return

  const tasks: Promise<void>[] = []
  codeBlocks.forEach((codeBlock, index) => {
    const pre = codeBlock.closest('pre')
    if (!pre) return

    const definition = codeBlock.textContent || ''
    const id = `mermaid-${Date.now()}-${index}`

    tasks.push(
      mermaid
        .render(id, definition)
        .then(({ svg }) => {
          pre.innerHTML = svg
          pre.classList.add('mermaid-rendered')
        })
        .catch((err: Error) => {
          pre.innerHTML = `<div class="mermaid-error">图表渲染失败: ${err.message}</div>`
        }),
    )
  })

  await Promise.all(tasks)
}
