import { describe, test, expect, beforeEach } from 'vitest'
import { useTabStore } from '../../../src/stores/tab-store'
import { useEditorStore } from '../../../src/stores/editor-store'

beforeEach(() => {
  useTabStore.setState({ tabs: [], activeTabId: null, _nextId: 0 })
  // ResetEditorStore
  useEditorStore.setState({ content: '', initialContent: '', contentKey: 0, isLoading: false, mode: 'split', focusMode: false, typewriterMode: false, isLargeFile: false })
})

describe('file-open-flow', () => {
  test('文件树打开文件 → 新建标签并激活', () => {
    useTabStore.getState().openFile('/docs/a.md', '# Hello')
    const s = useTabStore.getState()
    expect(s.tabs).toHaveLength(1)
    expect(s.tabs[0].filePath).toBe('/docs/a.md')
    expect(s.tabs[0].fileName).toBe('a.md')
    expect(s.activeTabId).toBe(s.tabs[0].id)
    expect(s.tabs[0].isModified).toBe(false)
  })

  test('文件树再次打开同一文件 → 仅切换标签不重复创建', () => {
    useTabStore.getState().openFile('/a.md', '# A')
    useTabStore.getState().openFile('/b.md', '# B')
    useTabStore.getState().openFile('/a.md', '# A again')
    const s = useTabStore.getState()
    expect(s.tabs).toHaveLength(2)
    expect(s.activeTabId).toBe(s.tabs[0].id)
    expect(s.tabs[0].filePath).toBe('/a.md')
  })

  test('搜索结果打开文件 → 标签新建并激活', () => {
    useTabStore.getState().openFile('/search/result.md', '## Found')
    const s = useTabStore.getState()
    expect(s.tabs).toHaveLength(1)
    expect(s.tabs[0].filePath).toBe('/search/result.md')
    expect(s.tabs[0].fileName).toBe('result.md')
  })

  test('从搜索结果打开已打开文件 → 切换标签不重复创建', () => {
    useTabStore.getState().openFile('/a.md', '# A')
    useTabStore.getState().openFile('/b.md', '# B')
    useTabStore.getState().openFile('/a.md', '# A')
    expect(useTabStore.getState().tabs).toHaveLength(2)
    expect(useTabStore.getState().tabs[0].filePath).toBe('/a.md')
  })
})
