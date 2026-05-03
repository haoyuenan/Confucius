import { describe, test, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FormatToolbar from '../../../src/components/Editor/FormatToolbar'

describe('FormatToolbar', () => {
  test('渲染所有按钮', () => {
    render(<FormatToolbar />)
    // 验证关键按钮存在（用 tooltip 属性匹配）
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(10)
  })

  test('渲染 H₁ H₂ H₃ 标题按钮', () => {
    render(<FormatToolbar />)
    expect(screen.getByText('H₁')).toBeInTheDocument()
    expect(screen.getByText('H₂')).toBeInTheDocument()
    expect(screen.getByText('H₃')).toBeInTheDocument()
  })

  test('渲染 B I S 按钮', () => {
    render(<FormatToolbar />)
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('I')).toBeInTheDocument()
    expect(screen.getByText('S')).toBeInTheDocument()
  })

  test('渲染引用/代码/列表按钮', () => {
    render(<FormatToolbar />)
    expect(screen.getByText('{ }')).toBeInTheDocument()
    expect(screen.getByText('`')).toBeInTheDocument()
    expect(screen.getByText('≡')).toBeInTheDocument()
    expect(screen.getByText('#')).toBeInTheDocument()
  })

  test('tooltip 属性存在', () => {
    render(<FormatToolbar />)
    const btn = screen.getByText('B')
    expect(btn.getAttribute('data-tooltip')).toContain('加粗')
  })
})
