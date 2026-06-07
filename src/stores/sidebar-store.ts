import { create } from 'zustand'
import type { FileTreeNode } from '../types/file-tree'
import type { SearchResult } from '../types/search'
import type { OutlineItem } from '../editor/outline-parser'

export type SidebarTab = string

const SIDEBAR_WIDTH_KEY = 'confucius-sidebar-width'

interface SidebarState {
  activeTab: SidebarTab
  rootPath: string | null
  fileTree: FileTreeNode | null
  expandedPaths: Set<string>
  selectedPath: string | null
  outlineItems: OutlineItem[]
  searchQuery: string
  searchResults: SearchResult[]
  isSearching: boolean

  setActiveTab: (tab: SidebarTab) => void
  setRootPath: (path: string | null) => void
  setFileTree: (tree: FileTreeNode | null) => void
  toggleExpand: (path: string) => void
  selectFile: (path: string | null) => void
  setExpandedPaths: (paths: string[]) => void
  setOutlineItems: (items: OutlineItem[]) => void
  setSearchQuery: (q: string) => void
  setSearchResults: (results: SearchResult[]) => void
  setIsSearching: (v: boolean) => void
  refreshFileTree: (tree: FileTreeNode) => void
  /** 从 localStorage 读取持久化的侧边栏宽度 */
  getSavedWidth: () => number
  /** 保存侧边栏宽度到 localStorage */
  saveWidth: (w: number) => void
}

export const useSidebarStore = create<SidebarState>((set) => ({
  activeTab: 'file-tree',
  rootPath: null,
  fileTree: null,
  expandedPaths: new Set(),
  selectedPath: null,
  outlineItems: [],
  searchQuery: '',
  searchResults: [],
  isSearching: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setRootPath: (path) => set({ rootPath: path }),
  setFileTree: (tree) => set({ fileTree: tree }),
  toggleExpand: (path) => set((s) => {
    const next = new Set(s.expandedPaths)
    next.has(path) ? next.delete(path) : next.add(path)
    return { expandedPaths: next }
  }),
  selectFile: (path) => set({ selectedPath: path }),
  setExpandedPaths: (paths) => set({ expandedPaths: new Set(paths) }),
  setOutlineItems: (items) => set({ outlineItems: items }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchResults: (results) => set({ searchResults: results }),
  setIsSearching: (v) => set({ isSearching: v }),
  refreshFileTree: (tree) => set({ fileTree: tree }),

  getSavedWidth: () => {
    try { return parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || '260', 10) } catch { return 260 }
  },
  saveWidth: (w) => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w))
  },
}))
