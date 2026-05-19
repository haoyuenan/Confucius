import { describe, test, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { themeService } from '../../../src/services/theme-service'
import ThemeSelector from '../../../src/components/Settings/ThemeSelector'

beforeEach(() => {
  localStorage.clear()
  themeService.switchTheme('plain-white')
})

describe('ThemeSelector', () => {
  test('渲染当前浅色模式下的主题按钮', () => {
    const { container } = render(<ThemeSelector />)
    expect(container.textContent).toContain('素白纸')
    expect(container.textContent).toContain('暖阳')
    expect(container.textContent).toContain('云白')
    expect(container.textContent).toContain('薄荷')
  })

  test('点击深色模式按钮切换 data-theme', () => {
    const { container } = render(<ThemeSelector />)
    const btn = container.querySelector('[title="选择主题"]') as HTMLElement | null
    expect(btn).toBeTruthy()
    fireEvent.click(btn!)
    expect(document.documentElement.getAttribute('data-theme')).toBe('night-black')
  })

  test('点击主题按钮切换 data-theme', () => {
    const { container } = render(<ThemeSelector />)
    const buttons = Array.from(container.querySelectorAll('button'))
    const btn = buttons.find((b) => b.textContent?.includes('暖阳'))
    expect(btn).toBeTruthy()
    fireEvent.click(btn!)
    expect(document.documentElement.getAttribute('data-theme')).toBe('warm-sun')
  })
})
