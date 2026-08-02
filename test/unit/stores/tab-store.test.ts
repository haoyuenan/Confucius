import { describe, test, expect, beforeEach, vi } from 'vitest'
import { useTabStore } from '../../../src/stores/tab-store'
import { save as dialogSave } from '@tauri-apps/plugin-dialog'

beforeEach(() => {
  vi.clearAllMocks()
  useTabStore.setState({ tabs: [], activeTabId: null })
})

describe('tab-store', () => {
  test('openFile 新文件创建标签并激活', () => {
    useTabStore.getState().openFile('/a/b.md', '# hello')
    const s = useTabStore.getState()
    expect(s.tabs).toHaveLength(1)
    expect(s.tabs[0].filePath).toBe('/a/b.md')
    expect(s.tabs[0].fileName).toBe('b.md')
    expect(s.tabs[0].content).toBe('# hello')
    expect(s.tabs[0].isModified).toBe(false)
    expect(s.activeTabId).toBe(s.tabs[0].id)
  })

  test('openFile 已存在文件时切换到已有标签不重复创建', () => {
    useTabStore.getState().openFile('/a.md', 'a')
    useTabStore.getState().openFile('/b.md', 'b')
    useTabStore.getState().openFile('/a.md', 'a')
    expect(useTabStore.getState().tabs).toHaveLength(2)
    const aTab = useTabStore.getState().tabs.find(t => t.filePath === '/a.md')
    expect(useTabStore.getState().activeTabId).toBe(aTab!.id)
  })

  test('newUntitledTab 创建未命名标签', () => {
    useTabStore.getState().newUntitledTab()
    const s = useTabStore.getState()
    expect(s.tabs).toHaveLength(1)
    expect(s.tabs[0].filePath).toBeNull()
    expect(s.tabs[0].content).toBe('')
    expect(s.activeTabId).toBe(s.tabs[0].id)
  })

  test('activateTab 切换到指定标签', () => {
    useTabStore.getState().openFile('/a.md', '# A')
    useTabStore.getState().openFile('/b.md', '# B')
    const aTab = useTabStore.getState().tabs.find(t => t.filePath === '/a.md')!
    useTabStore.getState().activateTab(aTab.id)
    expect(useTabStore.getState().activeTabId).toBe(aTab.id)
  })

  test('closeTab 未修改时直接删除', async () => {
    useTabStore.getState().openFile('/a.md', 'x')
    useTabStore.getState().openFile('/b.md', 'y')
    const aId = useTabStore.getState().tabs[0].id
    const result = await useTabStore.getState().closeTab(aId)
    expect(result).toBe(true)
    expect(useTabStore.getState().tabs).toHaveLength(1)
  })

  test('closeTab 最后一个标签时自动新建未命名标签', async () => {
    useTabStore.getState().openFile('/a.md', 'x')
    const id = useTabStore.getState().tabs[0].id
    await useTabStore.getState().closeTab(id)
    const s = useTabStore.getState()
    expect(s.tabs).toHaveLength(1)
    expect(s.tabs[0].filePath).toBeNull()
  })

  test('closeTab 关闭非活跃标签不切换', async () => {
    useTabStore.getState().openFile('/a.md', 'a')
    useTabStore.getState().openFile('/b.md', 'b')
    const aId = useTabStore.getState().tabs[0].id
    const bId = useTabStore.getState().tabs[1].id
    useTabStore.getState().activateTab(bId)
    await useTabStore.getState().closeTab(aId)
    expect(useTabStore.getState().activeTabId).toBe(bId)
  })

  test('updateContent 更新内容和 isModified', () => {
    useTabStore.getState().openFile('/a.md', 'original')
    const id = useTabStore.getState().activeTabId!
    useTabStore.getState().updateContent(id, 'modified')
    const tab = useTabStore.getState().tabs[0]
    expect(tab.content).toBe('modified')
    expect(tab.isModified).toBe(true)
  })

  test('markTabSaved 清除 isModified 并更新 savedContent', () => {
    useTabStore.getState().openFile('/a.md', 'original')
    const id = useTabStore.getState().activeTabId!
    useTabStore.getState().updateContent(id, 'modified')
    useTabStore.getState().markTabSaved(id)
    const tab = useTabStore.getState().tabs[0]
    expect(tab.isModified).toBe(false)
    expect(tab.savedContent).toBe('modified')
  })

  test('saveScrollTop 保存滚动位置', () => {
    useTabStore.getState().openFile('/a.md', 'x')
    const id = useTabStore.getState().activeTabId!
    useTabStore.getState().saveScrollTop(id, 123)
    expect(useTabStore.getState().tabs[0].scrollTop).toBe(123)
  })

  test('activeTab 返回当前活跃标签', () => {
    useTabStore.getState().openFile('/a.md', 'a')
    useTabStore.getState().openFile('/b.md', 'b')
    const active = useTabStore.getState().activeTab()
    expect(active!.filePath).toBe('/b.md')
  })

  test('activeTab tabs 为空时返回 null', () => {
    expect(useTabStore.getState().activeTab()).toBeNull()
  })

  test('saveTabToDisk 未命名标签弹另存为并更新标签路径', async () => {
    vi.mocked(dialogSave).mockResolvedValueOnce('/new/path.md' as any)
    useTabStore.getState().newUntitledTab()
    const id = useTabStore.getState().activeTabId!
    useTabStore.getState().updateContent(id, 'draft content')

    const ok = await useTabStore.getState().saveTabToDisk(id)

    expect(ok).toBe(true)
    const tab = useTabStore.getState().tabs[0]
    expect(tab.filePath).toBe('/new/path.md')
    expect(tab.fileName).toBe('path.md')
    expect(tab.isModified).toBe(false)
    expect(tab.savedContent).toBe('draft content')
  })

  test('saveTabToDisk 未命名标签取消另存为时不保存', async () => {
    vi.mocked(dialogSave).mockResolvedValueOnce(null)
    useTabStore.getState().newUntitledTab()
    const id = useTabStore.getState().activeTabId!
    useTabStore.getState().updateContent(id, 'draft')

    const ok = await useTabStore.getState().saveTabToDisk(id)

    expect(ok).toBe(false)
    const tab = useTabStore.getState().tabs[0]
    expect(tab.filePath).toBeNull()
    expect(tab.isModified).toBe(true)
  })

  test('closeTab 未命名修改标签点保存时转另存为并关闭', async () => {
    vi.mocked(dialogSave).mockResolvedValueOnce('/saved/note.md' as any)
    useTabStore.getState().openFile('/a.md', 'x')
    useTabStore.getState().newUntitledTab()
    const id = useTabStore.getState().activeTabId!
    useTabStore.getState().updateContent(id, 'draft')

    const ok = await useTabStore.getState().closeTab(id)

    expect(ok).toBe(true)
    expect(useTabStore.getState().tabs).toHaveLength(1)
    expect(useTabStore.getState().tabs[0].filePath).toBe('/a.md')
  })

  test('closeTab 未命名修改标签取消另存为时不关闭', async () => {
    vi.mocked(dialogSave).mockResolvedValueOnce(null)
    useTabStore.getState().newUntitledTab()
    const id = useTabStore.getState().activeTabId!
    useTabStore.getState().updateContent(id, 'draft')

    const ok = await useTabStore.getState().closeTab(id)

    expect(ok).toBe(false)
    expect(useTabStore.getState().tabs).toHaveLength(1)
    expect(useTabStore.getState().tabs[0].filePath).toBeNull()
  })
})
