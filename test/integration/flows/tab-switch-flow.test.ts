import { describe, test, expect, beforeEach } from 'vitest'
import { useTabStore } from '../../../src/stores/tab-store'
import { useEditorStore } from '../../../src/stores/editor-store'

beforeEach(() => {
  useTabStore.setState({ tabs: [], activeTabId: null, _nextId: 0 })
  useEditorStore.setState({ content: '', mode: 'split', focusMode: false, typewriterMode: false, isLargeFile: false })
})

describe('tab-switch-flow', () => {
  test('切换标签时 editorStore 内容正确更新', () => {
    useTabStore.getState().openFile('/a.md', '# File A')
    useTabStore.getState().openFile('/b.md', '# File B')
    expect(useEditorStore.getState().content).toBe('# File B')
    // 切回 A
    const tabA = useTabStore.getState().tabs[0]
    useTabStore.getState().activateTab(tabA.id)
    expect(useEditorStore.getState().content).toBe('# File A')
  })

  test('切换后编辑，切回再切回，内容保持独立', () => {
    useTabStore.getState().openFile('/a.md', '# A')
    useTabStore.getState().openFile('/b.md', '# B')
    const tabA = useTabStore.getState().tabs[0]
    const tabB = useTabStore.getState().tabs[1]
    // 编辑 B
    useTabStore.getState().updateContent(tabB.id, '# B edited')
    const s1 = useTabStore.getState()
    expect(s1.tabs.find(t => t.id === tabB.id)?.content).toBe('# B edited')
    // 切回 A
    useTabStore.getState().activateTab(tabA.id)
    expect(useEditorStore.getState().content).toBe('# A')
    // 再切回 B
    useTabStore.getState().activateTab(tabB.id)
    expect(useEditorStore.getState().content).toBe('# B edited')
  })

  test('每个标签独立维护 isModified 状态', () => {
    useTabStore.getState().openFile('/a.md', '# A')
    useTabStore.getState().openFile('/b.md', '# B')
    const tabA = useTabStore.getState().tabs[0]
    const tabB = useTabStore.getState().tabs[1]
    // 修改 A
    useTabStore.getState().updateContent(tabA.id, '# A modified')
    // 修改 B
    useTabStore.getState().updateContent(tabB.id, '# B modified')
    const s1 = useTabStore.getState()
    expect(s1.tabs.find(t => t.id === tabA.id)?.isModified).toBe(true)
    expect(s1.tabs.find(t => t.id === tabB.id)?.isModified).toBe(true)
    // 只保存 A → 重新读取 state
    useTabStore.getState().markTabSaved(tabA.id)
    const s2 = useTabStore.getState()
    expect(s2.tabs.find(t => t.id === tabA.id)?.isModified).toBe(false)
    expect(s2.tabs.find(t => t.id === tabB.id)?.isModified).toBe(true)
  })
})
