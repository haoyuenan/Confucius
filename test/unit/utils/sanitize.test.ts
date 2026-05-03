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
})
