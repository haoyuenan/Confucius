import { describe, test, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ThemeSelector from '../../../src/components/Settings/ThemeSelector'

beforeEach(() => {
  document.documentElement.setAttribute('data-theme', 'light')
  localStorage.clear()
})

describe('ThemeSelector', () => {
  test('渲染三个主题按钮', () => {
    render(<ThemeSelector />)
    expect(screen.getByText('☀️')).toBeInTheDocument()
    expect(screen.getByText('🌙')).toBeInTheDocument()
    expect(screen.getByText('📜')).toBeInTheDocument()
  })

  test('点击暗色按钮切换 data-theme', () => {
    render(<ThemeSelector />)
    fireEvent.click(screen.getByText('🌙'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  test('点击护眼按钮切换 data-theme', () => {
    render(<ThemeSelector />)
    fireEvent.click(screen.getByText('📜'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('sepia')
  })
})
