import { create } from 'zustand'
import * as bridge from '../services/electron-bridge'

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
    await bridge.knowledgeInitialize(workspacePath)
    set({ initialized: true })
  },

  loadBacklinks: async (filePath) => {
    const result = await bridge.knowledgeGetBacklinks(filePath)
    set({ backlinks: result.linked, unlinkedMentions: result.unlinked })
  },

  loadGraph: async (filePath) => {
    const data = await bridge.knowledgeGetGraph(filePath)
    set({ graphData: data })
  },

  loadTags: async () => {
    const tags = await bridge.knowledgeGetTags()
    set({ tags })
  },

  searchFiles: async (query) => {
    if (!query.trim()) { set({ searchResults: [] }); return }
    const results = await bridge.knowledgeSearchFiles(query)
    set({ searchResults: results })
  },
}))
