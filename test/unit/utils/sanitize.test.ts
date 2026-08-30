import { describe, test, expect } from 'vitest'
import { sanitizeHtml } from '../../../src/utils/sanitize'

describe('sanitize', () => {
  test('过滤 script 标签', () => {
    const result = sanitizeHtml('<script>alert(1)</script><p>safe</p>')
    expect(result).not.toContain('script')
    expect(result).toContain('safe')
  })

  test('保留安全标签', () => {
    const result = sanitizeHtml('<h1>Title</h1><a href="x">link</a>')
    expect(result).toContain('<h1>')
    expect(result).toContain('<a')
  })

  test('过滤 data-* 属性', () => {
    const result = sanitizeHtml('<span data-xss="evil">text</span>')
    expect(result).not.toContain('data-xss')
  })

  test('保留 Mermaid SVG 标签', () => {
    const result = sanitizeHtml('<svg><path d="M10 10"/></svg>')
    expect(result).toContain('<svg')
    expect(result).toContain('<path')
  })

  test('白名单属性保留', () => {
    const result = sanitizeHtml('<a href="https://example.com" onclick="evil()">link</a>')
    expect(result).toContain('href')
    expect(result).not.toContain('onclick')
  })

  test('过滤 onerror 事件', () => {
    const result = sanitizeHtml('<img src="x" onerror="alert(1)">')
    expect(result).not.toContain('onerror')
  })

  test('保留 wiki-link 标签及 data-title', () => {
    const result = sanitizeHtml('<wiki-link data-title="目标">label</wiki-link>')
    expect(result).toContain('<wiki-link')
    expect(result).toContain('data-title="目标"')
  })

  test('保留任务列表 input checkbox', () => {
    const result = sanitizeHtml('<ul><li><input type="checkbox" disabled> task</li></ul>')
    expect(result).toContain('<input')
    expect(result).toContain('type="checkbox"')
  })

  test('保留 KaTeX 的 data-tex 属性', () => {
    const result = sanitizeHtml('<span class="katex" data-tex="E=mc^2">x</span>')
    expect(result).toContain('data-tex="E=mc^2"')
  })

  test('保留 Mermaid SVG 的 style / transform 属性', () => {
    const result = sanitizeHtml(
      '<svg viewBox="0 0 100 100"><g transform="translate(1,2)"><text style="fill:#333">h</text></g></svg>',
    )
    expect(result).toContain('transform="translate(1,2)"')
    expect(result).toContain('style="fill:#333"')
  })

  test('未列入白名单的 data-* 属性仍被过滤', () => {
    const result = sanitizeHtml('<span data-xss="evil">text</span>')
    expect(result).not.toContain('data-xss')
  })
})
