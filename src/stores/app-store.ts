import { create } from 'zustand'

interface AppState {
  // 应用信息
  version: string

  // 侧边栏
  sidebarVisible: boolean
  sidebarWidth: number

  // 文件状态
  currentFilePath: string | null
  /** 上次保存时的内容快照，用于检测修改 */
  savedContent: string
  isModified: boolean
  /** 当前文件是否正处于加载中 */
  isLoading: boolean

  // Actions
  setVersion: (v: string) => void
  toggleSidebar: () => void
  setSidebarWidth: (w: number) => void

  /** 打开文件后设置文件信息 */
  openFile: (filePath: string, content: string) => void
  /** 保存成功后更新快照 */
  markSaved: (content: string) => void
  /** 新建文件 */
  newFile: () => void
  /** 根据实时内容对比更新 isModified */
  checkModification: (currentContent: string) => void
  /** 设置加载状态 */
  setIsLoading: (loading: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  // 初始状态
  version: '',
  sidebarVisible: true,
  sidebarWidth: 260,
  currentFilePath: null,
  savedContent: '',
  isModified: false,
  isLoading: false,

  // Actions
  setVersion: (v) => set({ version: v }),
  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),

  openFile: (filePath, content) =>
    set({
      currentFilePath: filePath,
      savedContent: content,
      isModified: false,
      isLoading: false,
    }),

  markSaved: (content) =>
    set({
      savedContent: content,
      isModified: false,
    }),

  newFile: () =>
    set({
      currentFilePath: null,
      savedContent: '',
      isModified: false,
    }),

  checkModification: (currentContent) =>
    set((s) => ({
      isModified: currentContent !== s.savedContent,
    })),

  setIsLoading: (loading) => set({ isLoading: loading }),
}))
