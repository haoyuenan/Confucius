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
})
