import { describe, test, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../../src/stores/app-store'

beforeEach(() => {
  useAppStore.setState({ version: '', sidebarVisible: true, sidebarWidth: 260 })
})

describe('app-store', () => {
  test('setVersion 更新版本号', () => {
    useAppStore.getState().setVersion('2.0.0')
    expect(useAppStore.getState().version).toBe('2.0.0')
  })

  test('toggleSidebar 翻转', () => {
    useAppStore.getState().toggleSidebar()
    expect(useAppStore.getState().sidebarVisible).toBe(false)
    useAppStore.getState().toggleSidebar()
    expect(useAppStore.getState().sidebarVisible).toBe(true)
  })

  test('setSidebarWidth 设置宽度', () => {
    useAppStore.getState().setSidebarWidth(300)
    expect(useAppStore.getState().sidebarWidth).toBe(300)
  })
})
