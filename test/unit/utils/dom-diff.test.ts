import { describe, test, expect, beforeEach } from 'vitest'
import { updatePreviewContent } from '../../../src/utils/dom-diff'

describe('dom-diff', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
  })

  test('初始设置内容', () => {
    updatePreviewContent(container, '<p>hello</p>')
    expect(container.innerHTML).toContain('hello')
  })

  test('增量更新替换文本内容', () => {
    container.innerHTML = '<p>old</p>'
    updatePreviewContent(container, '<p>new</p>')
    expect(container.innerHTML).toContain('new')
    expect(container.innerHTML).not.toContain('old')
  })

  test('跳过 mermaid-rendered 元素', () => {
    container.innerHTML = '<pre class="mermaid-rendered"><svg></svg></pre><p>keep</p>'
    const newHtml = '<pre class="mermaid-rendered"><svg></svg></pre><p>updated</p>'
    updatePreviewContent(container, newHtml)
    // mermaid-rendered 应保持不被替换
    const pre = container.querySelector('.mermaid-rendered')
    expect(pre).not.toBeNull()
    expect(container.innerHTML).toContain('updated')
  })

  test('mermaid 源码未变时跳过渲染产物', () => {
    container.innerHTML = '<pre class="mermaid-rendered" data-mermaid-src="graph TD;\nA-->B;"><svg></svg></pre>'
    const newHtml = '<pre class="mermaid-container"><code class="language-mermaid">graph TD;\nA-->B;</code></pre>'
    updatePreviewContent(container, newHtml)
    const pre = container.querySelector('.mermaid-rendered')
    expect(pre).not.toBeNull()
    expect(pre!.querySelector('svg')).not.toBeNull()
  })

  test('mermaid 源码变化时更新渲染产物', () => {
    container.innerHTML = '<pre class="mermaid-rendered" data-mermaid-src="graph TD;\nA-->B;"><svg></svg></pre>'
    const newHtml = '<pre class="mermaid-container"><code class="language-mermaid">graph TD;\nA-->C;</code></pre>'
    updatePreviewContent(container, newHtml)
    // 渲染产物被替换为新源码 pre，等待重新渲染
    expect(container.querySelector('.mermaid-rendered')).toBeNull()
    const code = container.querySelector('code.language-mermaid')
    expect(code?.textContent).toContain('A-->C')
  })

  test('KaTeX 内容相同时跳过，变化时更新', () => {
    container.innerHTML = '<span class="katex"><span class="katex-html">old-math</span></span>'
    updatePreviewContent(container, '<span class="katex"><span class="katex-html">old-math</span></span>')
    expect(container.querySelector('.katex-html')?.textContent).toBe('old-math')

    updatePreviewContent(container, '<span class="katex"><span class="katex-html">new-math</span></span>')
    expect(container.querySelector('.katex-html')?.textContent).toBe('new-math')
  })

  test('已加载 base64 的图片引用未变时跳过 src 更新', () => {
    container.innerHTML = '<img src="data:image/png;base64,AAA" data-b64-loaded="1" data-b64-src="img/a.png">'
    updatePreviewContent(container, '<img src="img/a.png">')
    const img = container.querySelector('img')!
    expect(img.src).toContain('data:image/png')
    expect(img.dataset.b64Loaded).toBe('1')
  })

  test('图片引用变化时更新 src', () => {
    container.innerHTML = '<img src="data:image/png;base64,AAA" data-b64-loaded="1" data-b64-src="img/a.png">'
    updatePreviewContent(container, '<img src="img/b.png">')
    const img = container.querySelector('img')!
    expect(img.getAttribute('src')).toBe('img/b.png')
    expect(img.dataset.b64Loaded).toBeUndefined()
  })
})
