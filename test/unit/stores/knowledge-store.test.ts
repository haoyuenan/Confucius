import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useKnowledgeStore } from '../../../src/stores/knowledge-store'
import { useSidebarStore } from '../../../src/stores/sidebar-store'
import { useTabStore } from '../../../src/stores/tab-store'

vi.mock('../../../src/services/bridge', () => ({
  knowledgeReindexRust: vi.fn(async () => {}),
  knowledgeReindex: vi.fn(async () => true),
  knowledgeSearchFiles: vi.fn(async () => []),
  knowledgeGetBacklinksRust: vi.fn(async () => []),
  knowledgeGetGraphRust: vi.fn(async () => ({ nodes: [], links: [] })),
  knowledgeGetTagsRust: vi.fn(async () => ({})),
  knowledgeGetBacklinks: vi.fn(async () => ({ linked: [], unlinked: [] })),
  knowledgeGetGraph: vi.fn(async () => ({ nodes: [], links: [] })),
  knowledgeGetTags: vi.fn(async () => ({})),
}))

import * as bridge from '../../../src/services/bridge'

function makeTab(filePath: string) {
  return {
    id: 't1',
    filePath,
    fileName: filePath.split(/[\\/]/).pop() ?? '',
    content: '',
    savedContent: '',
    isModified: false,
    scrollTop: 0,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  useKnowledgeStore.setState({ initialized: false, useRustBackend: false })
  useSidebarStore.setState({ rootPath: null })
  useTabStore.setState({ tabs: [], activeTabId: null })
})

describe('knowledge-store reindex', () => {
  it('未初始化时直接跳过', async () => {
    useSidebarStore.setState({ rootPath: '/root' })
    useKnowledgeStore.setState({ initialized: false })
    await useKnowledgeStore.getState().reindex(['/root/a.md'])
    expect(bridge.knowledgeReindexRust).not.toHaveBeenCalled()
    expect(bridge.knowledgeReindex).not.toHaveBeenCalled()
  })

  it('无工作区时直接跳过', async () => {
    useKnowledgeStore.setState({ initialized: true })
    await useKnowledgeStore.getState().reindex(['/root/a.md'])
    expect(bridge.knowledgeReindexRust).not.toHaveBeenCalled()
    expect(bridge.knowledgeReindex).not.toHaveBeenCalled()
  })

  it('空路径列表不触发调用', async () => {
    useKnowledgeStore.setState({ initialized: true })
    useSidebarStore.setState({ rootPath: '/root' })
    await useKnowledgeStore.getState().reindex([])
    expect(bridge.knowledgeReindexRust).not.toHaveBeenCalled()
    expect(bridge.knowledgeReindex).not.toHaveBeenCalled()
  })

  it('Rust 后端逐路径调用 knowledgeReindexRust 并刷新视图', async () => {
    useKnowledgeStore.setState({ initialized: true, useRustBackend: true })
    useSidebarStore.setState({ rootPath: '/root' })
    useTabStore.setState({ tabs: [makeTab('/root/a.md')], activeTabId: 't1' })

    await useKnowledgeStore.getState().reindex(['/root/a.md', '/root/b.md'])

    expect(bridge.knowledgeReindexRust).toHaveBeenCalledTimes(2)
    expect(bridge.knowledgeReindexRust).toHaveBeenNthCalledWith(1, '/root', '/root/a.md')
    expect(bridge.knowledgeReindexRust).toHaveBeenNthCalledWith(2, '/root', '/root/b.md')
    // 刷新反链/局部图谱/标签
    expect(bridge.knowledgeGetBacklinksRust).toHaveBeenCalledWith('/root/a.md')
    expect(bridge.knowledgeGetGraphRust).toHaveBeenCalledWith('/root/a.md')
    expect(bridge.knowledgeGetTagsRust).toHaveBeenCalled()
  })

  it('JS 后端逐路径调用 knowledgeReindex', async () => {
    useKnowledgeStore.setState({ initialized: true, useRustBackend: false })
    useSidebarStore.setState({ rootPath: '/root' })

    await useKnowledgeStore.getState().reindex(['/root/a.md'])

    expect(bridge.knowledgeReindex).toHaveBeenCalledTimes(1)
    expect(bridge.knowledgeReindex).toHaveBeenCalledWith('/root/a.md')
    expect(bridge.knowledgeReindexRust).not.toHaveBeenCalled()
  })

  it('searchFiles 委托 bridge（Rust 后端走 Tantivy 分流）', async () => {
    useKnowledgeStore.setState({ initialized: true, useRustBackend: true })
    ;(bridge.knowledgeSearchFiles as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ path: '/root/note.md', title: 'note', mtime: '' }])

    await useKnowledgeStore.getState().searchFiles('note')

    expect(bridge.knowledgeSearchFiles).toHaveBeenCalledWith('note')
    expect(useKnowledgeStore.getState().searchResults).toEqual([
      { path: '/root/note.md', title: 'note', mtime: '' },
    ])
  })

  it('searchFiles 空查询时清空结果', async () => {
    useKnowledgeStore.setState({ searchResults: [{ path: '/a.md', title: 'a', mtime: '' }] })
    await useKnowledgeStore.getState().searchFiles('   ')
    expect(useKnowledgeStore.getState().searchResults).toEqual([])
    expect(bridge.knowledgeSearchFiles).not.toHaveBeenCalled()
  })
})
