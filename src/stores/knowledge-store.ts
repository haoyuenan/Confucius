import { create } from 'zustand'
import * as bridge from '../services/bridge'

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
  loadBacklinks: (filePath: string) => Promise<void>
  loadGraph: (filePath?: string) => Promise<void>
  loadTags: () => Promise<void>
  searchFiles: (query: string) => Promise<void>
}

function getUseRust(): boolean {
  return localStorage.getItem(BACKEND_KEY) === 'rust'
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
