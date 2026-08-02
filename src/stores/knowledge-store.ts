import { create } from 'zustand'
import * as bridge from '../services/bridge'
import { useSidebarStore } from './sidebar-store'
import { useTabStore } from './tab-store'

const BACKEND_KEY = 'confucius-knowledge-backend'

interface BacklinkEntry {
  source: string
  target: string
  resolved: boolean
  targetPath?: string
}

interface GraphData {
  nodes: string[]
  links: BacklinkEntry[]
}

interface KnowledgeState {
  initialized: boolean
  useRustBackend: boolean
  backlinks: BacklinkEntry[]
  unlinkedMentions: string[]
  graphData: GraphData
  tags: Record<string, string[]>
  searchResults: Array<{ path: string; title: string; mtime: string }>

  initialize: (workspacePath: string) => Promise<void>
  /** 文件变更后增量更新索引（watcher 事件触发） */
  reindex: (paths: string[]) => Promise<void>
  loadBacklinks: (filePath: string) => Promise<void>
  loadGraph: (filePath?: string) => Promise<void>
  loadTags: () => Promise<void>
  searchFiles: (query: string) => Promise<void>
}

function getUseRust(): boolean {
  // Rust 为正式引擎（默认）；localStorage 显式设为 'js' 时回退 JS 引擎
  return localStorage.getItem(BACKEND_KEY) !== 'js'
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  initialized: false,
  useRustBackend: getUseRust(),
  backlinks: [],
  unlinkedMentions: [],
  graphData: { nodes: [], links: [] },
  tags: {},
  searchResults: [],

  initialize: async (workspacePath) => {
    const useRust = getUseRust()
    try {
      if (useRust) {
        await bridge.knowledgeInitRust(workspacePath)
      } else {
        await bridge.knowledgeInitialize(workspacePath)
      }
      set({ initialized: true, useRustBackend: useRust })
    } catch (err) {
      console.error('知识库初始化失败:', err)
    }
  },

  reindex: async (paths) => {
    const { initialized, useRustBackend } = get()
    if (!initialized || paths.length === 0) return
    const root = useSidebarStore.getState().rootPath
    if (!root) return
    try {
      if (useRustBackend) {
        for (const p of paths) {
          await bridge.knowledgeReindexRust(root, p)
        }
      } else {
        for (const p of paths) {
          await bridge.knowledgeReindex(p)
        }
      }
      // 刷新当前视图：反链 / 局部图谱 / 标签
      const activeTab = useTabStore.getState().activeTab()
      if (activeTab?.filePath) {
        await get().loadBacklinks(activeTab.filePath)
        await get().loadGraph(activeTab.filePath)
      }
      await get().loadTags()
    } catch (err) {
      console.error('知识库索引更新失败:', err)
    }
  },

  loadBacklinks: async (filePath) => {
    const { useRustBackend } = get()
    try {
      if (useRustBackend) {
        const links = await bridge.knowledgeGetBacklinksRust(filePath)
        set({ backlinks: links, unlinkedMentions: [] })
      } else {
        const result = await bridge.knowledgeGetBacklinks(filePath)
        set({ backlinks: result.linked, unlinkedMentions: result.unlinked })
      }
    } catch (err) {
      console.error('加载反向链接失败:', err)
    }
  },

  loadGraph: async (filePath) => {
    const { useRustBackend } = get()
    try {
      if (useRustBackend) {
        const data = await bridge.knowledgeGetGraphRust(filePath)
        set({ graphData: { nodes: data.nodes, links: data.links } })
      } else {
        const data = await bridge.knowledgeGetGraph(filePath)
        set({ graphData: data })
      }
    } catch (err) {
      console.error('加载知识图谱失败:', err)
    }
  },

  loadTags: async () => {
    const { useRustBackend } = get()
    try {
      if (useRustBackend) {
        const tags = await bridge.knowledgeGetTagsRust()
        set({ tags })
      } else {
        const tags = await bridge.knowledgeGetTags()
        set({ tags })
      }
    } catch (err) {
      console.error('加载标签失败:', err)
    }
  },

  searchFiles: async (query) => {
    if (!query.trim()) { set({ searchResults: [] }); return }
    try {
      const results = await bridge.knowledgeSearchFiles(query)
      set({ searchResults: results })
    } catch (err) {
      console.error('搜索文件失败:', err)
    }
  },
}))
