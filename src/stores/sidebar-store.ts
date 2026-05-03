import { create } from 'zustand'
import type { FileTreeNode } from '../types/file-tree'
import type { SearchResult } from '../types/search'

export type SidebarTab = 'file-tree' | 'outline' | 'search'

interface SidebarState {
  activeTab: SidebarTab
  /** 当前打开的根文件夹路径 */
  rootPath: string | null
  fileTree: FileTreeNode | null
  expandedPaths: Set<string>
  selectedPath: string | null
  outlineItems: { level: number; text: string; from: number; to: number }[]
  searchQuery: string
  searchResults: SearchResult[]
  isSearching: boolean

  setActiveTab: (tab: SidebarTab) => void
  setRootPath: (path: string | null) => void
  setFileTree: (tree: FileTreeNode | null) => void
  toggleExpand: (path: string) => void
  selectFile: (path: string | null) => void
  setOutlineItems: (items: { level: number; text: string; from: number; to: number }[]) => void
  setSearchQuery: (q: string) => void
  setSearchResults: (results: SearchResult[]) => void
  setIsSearching: (v: boolean) => void
  /** 重建文件树（展开状态不变） */
  refreshFileTree: (tree: FileTreeNode) => void
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

  toggleExpand: (path) =>
    set((s) => {
      const next = new Set(s.expandedPaths)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return { expandedPaths: next }
    }),

  selectFile: (path) => set({ selectedPath: path }),
  setOutlineItems: (items) => set({ outlineItems: items }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchResults: (results) => set({ searchResults: results }),
  setIsSearching: (v) => set({ isSearching: v }),

  refreshFileTree: (tree) => set({ fileTree: tree }),
}))
