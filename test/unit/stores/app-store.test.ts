import { describe, test, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../../src/stores/app-store'

beforeEach(() => {
  useAppStore.setState({
    version: '',
    sidebarVisible: true,
    sidebarWidth: 260,
    currentFilePath: null,
    savedContent: '',
    isModified: false,
    isLoading: false,
  })
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

  test('openFile 设置文件路径和内容', () => {
    useAppStore.getState().openFile('/test.md', '# content')
    expect(useAppStore.getState().currentFilePath).toBe('/test.md')
    expect(useAppStore.getState().savedContent).toBe('# content')
    expect(useAppStore.getState().isModified).toBe(false)
    expect(useAppStore.getState().isLoading).toBe(false)
  })

  test('markSaved 更新保存快照', () => {
    useAppStore.getState().openFile('/a.md', 'old')
    useAppStore.getState().markSaved('new content')
    expect(useAppStore.getState().savedContent).toBe('new content')
    expect(useAppStore.getState().isModified).toBe(false)
  })

  test('newFile 重置文件状态', () => {
    useAppStore.getState().openFile('/a.md', 'text')
    useAppStore.getState().newFile()
    expect(useAppStore.getState().currentFilePath).toBeNull()
    expect(useAppStore.getState().savedContent).toBe('')
    expect(useAppStore.getState().isModified).toBe(false)
  })

  test('checkModification 检测内容变更', () => {
    useAppStore.getState().openFile('/a.md', 'original')
    useAppStore.getState().checkModification('changed')
    expect(useAppStore.getState().isModified).toBe(true)
    useAppStore.getState().checkModification('original')
    expect(useAppStore.getState().isModified).toBe(false)
  })

  test('setIsLoading 切换加载状态', () => {
    useAppStore.getState().setIsLoading(true)
    expect(useAppStore.getState().isLoading).toBe(true)
  })
})
