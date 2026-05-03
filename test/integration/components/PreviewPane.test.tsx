import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PreviewPane from '../../../src/components/Preview/PreviewPane'

// mock mermaid 渲染
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: () => Promise.resolve({ svg: '<svg></svg>' }),
  },
}))

describe('PreviewPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('渲染 Markdown 为 HTML', () => {
    const { container } = render(<PreviewPane content="# Hello\n**bold**" />)
    // markdown-body 容器应存在
    expect(container.querySelector('.markdown-body')).toBeInTheDocument()
  })

  test('标题被渲染', () => {
    const { container } = render(<PreviewPane content="# Title" />)
    expect(container.innerHTML).toContain('Title')
  })

  test('XSS 被过滤', () => {
    const { container } = render(<PreviewPane content='<script>alert(1)</script>text' />)
    expect(container.innerHTML).not.toContain('<script>')
    expect(container.innerHTML).toContain('text')
  })
})
