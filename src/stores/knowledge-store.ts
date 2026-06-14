import { create } from 'zustand'
import * as bridge from '../services/bridge'

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

export const useKnowledgeStore = create<KnowledgeState>((set) => ({
  initialized: false,
  backlinks: [],
  unlinkedMentions: [],
  graphData: { nodes: [], links: [] },
  tags: {},
  searchResults: [],

  initialize: async (workspacePath) => {
    try {
      await bridge.knowledgeInitialize(workspacePath)
      set({ initialized: true })
    } catch (err) {
      console.error('知识库初始化失败:', err)
    }
  },

  loadBacklinks: async (filePath) => {
    try {
      const result = await bridge.knowledgeGetBacklinks(filePath)
      set({ backlinks: result.linked, unlinkedMentions: result.unlinked })
    } catch (err) {
      console.error('加载反向链接失败:', err)
    }
  },

  loadGraph: async (filePath) => {
    try {
      const data = await bridge.knowledgeGetGraph(filePath)
      set({ graphData: data })
    } catch (err) {
      console.error('加载知识图谱失败:', err)
    }
  },

  loadTags: async () => {
    try {
      const tags = await bridge.knowledgeGetTags()
      set({ tags })
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
