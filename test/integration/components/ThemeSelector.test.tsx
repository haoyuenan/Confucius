import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { themeService } from '../../../src/services/theme-service'
import ThemeSelector from '../../../src/components/Settings/ThemeSelector'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'theme.name.plain-white': '素白纸',
        'theme.name.warm-sun': '暖阳',
        'theme.name.cloud': '云白',
        'theme.name.mint': '薄荷',
        'theme.name.tokyo-night-light': '东京夜白',
        'theme.name.rose-pine-dawn': '玫瑰黎明',
        'theme.name.night-black': '暗夜黑',
        'theme.name.deep-sea': '深海',
        'theme.name.warm-gray': '暖灰',
        'theme.name.mo-zhu': '墨竹',
        'theme.name.tokyo-night': '东京夜',
        'theme.name.rose-pine': '玫瑰松',
        'app.toolbar.pickTheme': '主题',
      }
      return map[key] || key
    },
  }),
}))

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
    const btn = container.querySelector('[data-testid="theme-mode-toggle"]') as HTMLElement | null
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
