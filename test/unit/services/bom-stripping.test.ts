// @vitest-environment node

import { describe, test, expect } from 'vitest'

/**
 * From Rust read_file_utf8, the content is already decoded as UTF-8.
 * We only need to strip the leading BOM character (U+FEFF) if present.
 * This mirrors the logic in src/services/bridge.ts readFile.
 */
function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content
}

describe('BOM stripping (post-UTF-8 decode)', () => {
  test('removes UTF-8 BOM (U+FEFF) from the start of content', () => {
    const raw = '\uFEFF你好世界'
    expect(stripBom(raw)).toBe('你好世界')
  })

  test('returns unchanged content when no BOM present', () => {
    const raw = 'Hello, World!'
    expect(stripBom(raw)).toBe('Hello, World!')
  })

  test('returns empty string for empty input', () => {
    expect(stripBom('')).toBe('')
  })

  test('preserves BOM-less CJK text', () => {
    const raw = '中华人民共和国'
    expect(stripBom(raw)).toBe('中华人民共和国')
  })

  test('handles only-BOM content', () => {
    const raw = '\uFEFF'
    expect(stripBom(raw)).toBe('')
  })
})
