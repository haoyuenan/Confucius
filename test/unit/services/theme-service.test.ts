import { describe, test, expect, beforeEach, vi } from 'vitest'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  const old = document.getElementById('hljs-theme') as HTMLLinkElement | null
  if (old) old.remove()
  const link = document.createElement('link')
  link.id = 'hljs-theme'
  link.rel = 'stylesheet'
  document.head.appendChild(link)
  vi.resetModules()
})

describe('theme-service', () => {
  test('默认主题为 light，data-theme 正确设置', async () => {
    const { themeService } = await import('../../../src/services/theme-service')
    expect(themeService.getCurrentTheme()).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  test('switchTheme 切换为 dark 并持久化到 localStorage', async () => {
    const { themeService } = await import('../../../src/services/theme-service')
    themeService.switchTheme('dark')
    expect(themeService.getCurrentTheme()).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('confucius-theme')).toBe('dark')
  })

  test('switchTheme 切换为 sepia 并持久化到 localStorage', async () => {
    const { themeService } = await import('../../../src/services/theme-service')
    themeService.switchTheme('sepia')
    expect(themeService.getCurrentTheme()).toBe('sepia')
    expect(localStorage.getItem('confucius-theme')).toBe('sepia')
  })

  test('toggleTheme light→dark→sepia→light 循环', async () => {
    const { themeService } = await import('../../../src/services/theme-service')
    themeService.toggleTheme()
    expect(themeService.getCurrentTheme()).toBe('dark')
    themeService.toggleTheme()
    expect(themeService.getCurrentTheme()).toBe('sepia')
    themeService.toggleTheme()
    expect(themeService.getCurrentTheme()).toBe('light')
  })

  test('localStorage 已保存 dark 则恢复为 dark', async () => {
    localStorage.setItem('confucius-theme', 'dark')
    const { themeService } = await import('../../../src/services/theme-service')
    expect(themeService.getCurrentTheme()).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
