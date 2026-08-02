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
  test('默认主题为 plain-white，data-theme 正确设置', async () => {
    const { themeService } = await import('../../../src/services/theme-service')
    expect(themeService.getCurrentTheme()).toBe('plain-white')
    expect(document.documentElement.getAttribute('data-theme')).toBe('plain-white')
  })

  test('switchTheme 切换为 night-black 并持久化到 localStorage', async () => {
    const { themeService } = await import('../../../src/services/theme-service')
    themeService.switchTheme('night-black')
    expect(themeService.getCurrentTheme()).toBe('night-black')
    expect(document.documentElement.getAttribute('data-theme')).toBe('night-black')
    expect(localStorage.getItem('confucius-theme')).toBe('night-black')
  })

  test('switchTheme 切换为 warm-sun 并持久化到 localStorage', async () => {
    const { themeService } = await import('../../../src/services/theme-service')
    themeService.switchTheme('warm-sun')
    expect(themeService.getCurrentTheme()).toBe('warm-sun')
    expect(localStorage.getItem('confucius-theme')).toBe('warm-sun')
  })

  test('toggleTheme light mode → dark mode 循环', async () => {
    const { themeService } = await import('../../../src/services/theme-service')
    expect(themeService.getCurrentMode()).toBe('light')
    themeService.toggleTheme()
    expect(themeService.getCurrentTheme()).toBe('night-black')
    expect(themeService.getCurrentMode()).toBe('dark')
    themeService.toggleTheme()
    expect(themeService.getCurrentTheme()).toBe('plain-white')
    expect(themeService.getCurrentMode()).toBe('light')
  })

  test('本地已保存 legacy light 则映射为 plain-white', async () => {
    localStorage.setItem('confucius-theme', 'light')
    const { themeService } = await import('../../../src/services/theme-service')
    expect(themeService.getCurrentTheme()).toBe('plain-white')
    expect(document.documentElement.getAttribute('data-theme')).toBe('plain-white')
  })

  test('本地已保存 legacy dark 则映射为 night-black', async () => {
    localStorage.setItem('confucius-theme', 'dark')
    const { themeService } = await import('../../../src/services/theme-service')
    expect(themeService.getCurrentTheme()).toBe('night-black')
  })

  test('本地已保存 legacy sepia 则映射为 warm-sun', async () => {
    localStorage.setItem('confucius-theme', 'sepia')
    const { themeService } = await import('../../../src/services/theme-service')
    expect(themeService.getCurrentTheme()).toBe('warm-sun')
  })

  test('本地已保存 night-black 则恢复正确', async () => {
    localStorage.setItem('confucius-theme', 'night-black')
    const { themeService } = await import('../../../src/services/theme-service')
    expect(themeService.getCurrentTheme()).toBe('night-black')
    expect(document.documentElement.getAttribute('data-theme')).toBe('night-black')
  })

  test('本地已保存无效主题 id 时回退默认主题且不抛错', async () => {
    localStorage.setItem('confucius-theme', 'not-a-real-theme')
    const { themeService } = await import('../../../src/services/theme-service')
    expect(themeService.getCurrentTheme()).toBe('plain-white')
    expect(document.documentElement.getAttribute('data-theme')).toBe('plain-white')
  })

  test('本地保存空字符串时回退默认主题', async () => {
    localStorage.setItem('confucius-theme', '')
    const { themeService } = await import('../../../src/services/theme-service')
    expect(themeService.getCurrentTheme()).toBe('plain-white')
  })
})
