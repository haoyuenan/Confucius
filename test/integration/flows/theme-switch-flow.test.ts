import { describe, test, expect, beforeEach, vi } from 'vitest'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  vi.resetModules()
})

describe('theme-switch-flow', () => {
  test('切换不同主题 data-theme 正确', async () => {
    const { themeService } = await import('../../../src/services/theme-service')
    expect(document.documentElement.getAttribute('data-theme')).toBe('plain-white')

    themeService.switchTheme('night-black')
    expect(document.documentElement.getAttribute('data-theme')).toBe('night-black')
    expect(localStorage.getItem('confucius-theme')).toBe('night-black')

    themeService.switchTheme('eye-care')
    expect(document.documentElement.getAttribute('data-theme')).toBe('eye-care')
    expect(localStorage.getItem('confucius-theme')).toBe('eye-care')

    themeService.switchTheme('plain-white')
    expect(document.documentElement.getAttribute('data-theme')).toBe('plain-white')
    expect(localStorage.getItem('confucius-theme')).toBe('plain-white')
  })

  test('toggleTheme 循环 light mode → dark mode → light mode', async () => {
    const { themeService } = await import('../../../src/services/theme-service')
    themeService.toggleTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('night-black')
    expect(localStorage.getItem('confucius-theme')).toBe('night-black')
    themeService.toggleTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('plain-white')
    expect(localStorage.getItem('confucius-theme')).toBe('plain-white')
  })

  test('localStorage 持久化 — 刷新后恢复主题', async () => {
    localStorage.setItem('confucius-theme', 'eye-care')
    const { themeService } = await import('../../../src/services/theme-service')
    expect(themeService.getCurrentTheme()).toBe('eye-care')
    expect(document.documentElement.getAttribute('data-theme')).toBe('eye-care')
  })
})
