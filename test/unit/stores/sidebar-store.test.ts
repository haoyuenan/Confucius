import { describe, test, expect, beforeEach } from 'vitest'
import { useSidebarStore } from '../../../src/stores/sidebar-store'

beforeEach(() => {
  useSidebarStore.setState({
    activeTab: 'file-tree',
    rootPath: null,
    fileTree: null,
    expandedPaths: new Set(),
    selectedPath: null,
    outlineItems: [],
    searchQuery: '',
    searchResults: [],
    isSearching: false,
  })
})

describe('sidebar-store', () => {
  test('setActiveTab 切换标签', () => {
    useSidebarStore.getState().setActiveTab('search')
    expect(useSidebarStore.getState().activeTab).toBe('search')
    useSidebarStore.getState().setActiveTab('outline')
    expect(useSidebarStore.getState().activeTab).toBe('outline')
  })

  test('setRootPath 设置根路径', () => {
    useSidebarStore.getState().setRootPath('/project')
    expect(useSidebarStore.getState().rootPath).toBe('/project')
    useSidebarStore.getState().setRootPath(null)
    expect(useSidebarStore.getState().rootPath).toBeNull()
  })

  test('setFileTree 设置文件树', () => {
    const tree = { name: 'src', path: '/src', type: 'directory' as const, children: [] }
    useSidebarStore.getState().setFileTree(tree)
    expect(useSidebarStore.getState().fileTree).toEqual(tree)
  })

  test('toggleExpand 展开/折叠目录', () => {
    useSidebarStore.getState().toggleExpand('/a')
    expect(useSidebarStore.getState().expandedPaths.has('/a')).toBe(true)
    useSidebarStore.getState().toggleExpand('/a')
    expect(useSidebarStore.getState().expandedPaths.has('/a')).toBe(false)
  })

  test('selectFile 选中文件', () => {
    useSidebarStore.getState().selectFile('/a.md')
    expect(useSidebarStore.getState().selectedPath).toBe('/a.md')
    useSidebarStore.getState().selectFile(null)
    expect(useSidebarStore.getState().selectedPath).toBeNull()
  })

  test('setOutlineItems 设置大纲', () => {
    const items = [{ level: 1 as const, text: 'Title', from: 0, to: 6 }]
    useSidebarStore.getState().setOutlineItems(items)
    expect(useSidebarStore.getState().outlineItems).toEqual(items)
  })

  test('setSearchQuery / setSearchResults / setIsSearching 搜索状态', () => {
    useSidebarStore.getState().setSearchQuery('keyword')
    expect(useSidebarStore.getState().searchQuery).toBe('keyword')

    useSidebarStore.getState().setIsSearching(true)
    expect(useSidebarStore.getState().isSearching).toBe(true)

    const results = [{ filePath: '/a.md', fileName: 'a.md', lineNumber: 1, lineContent: 'keyword', matchStart: 0, matchEnd: 7 }]
    useSidebarStore.getState().setSearchResults(results)
    expect(useSidebarStore.getState().searchResults).toEqual(results)
  })

  test('refreshFileTree 刷新树', () => {
    const old = { name: 'old', path: '/old', type: 'directory' as const, children: [] }
    useSidebarStore.getState().setFileTree(old)
    const updated = { name: 'new', path: '/new', type: 'directory' as const, children: [] }
    useSidebarStore.getState().refreshFileTree(updated)
    expect(useSidebarStore.getState().fileTree).toEqual(updated)
  })

  test('saveWidth / getSavedWidth localStorage 持久化', () => {
    useSidebarStore.getState().saveWidth(320)
    const saved = useSidebarStore.getState().getSavedWidth()
    expect(saved).toBe(320)
  })

  test('getSavedWidth localStorage 无值时返回默认 260', () => {
    localStorage.removeItem('confucius-sidebar-width')
    expect(useSidebarStore.getState().getSavedWidth()).toBe(260)
  })
})
