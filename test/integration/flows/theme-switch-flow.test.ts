import { describe, test, expect, beforeEach, vi } from 'vitest'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  vi.resetModules()
})

describe('theme-switch-flow', () => {
  test('亮色→暗色→护眼 循环切换 data-theme 正确', async () => {
    const { themeService } = await import('../../../src/services/theme-service')
    // 默认 light，data-theme 已设置
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    themeService.switchTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('confucius-theme')).toBe('dark')

    themeService.switchTheme('sepia')
    expect(document.documentElement.getAttribute('data-theme')).toBe('sepia')
    expect(localStorage.getItem('confucius-theme')).toBe('sepia')

    themeService.switchTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('confucius-theme')).toBe('light')
  })

  test('toggleTheme 循环 light→dark→sepia→light', async () => {
    const { themeService } = await import('../../../src/services/theme-service')
    themeService.toggleTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('confucius-theme')).toBe('dark')
    themeService.toggleTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('sepia')
    themeService.toggleTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  test('localStorage 持久化 — 刷新后恢复主题', async () => {
    localStorage.setItem('confucius-theme', 'sepia')
    const { themeService } = await import('../../../src/services/theme-service')
    expect(themeService.getCurrentTheme()).toBe('sepia')
    expect(document.documentElement.getAttribute('data-theme')).toBe('sepia')
  })
})
