import { create } from 'zustand'

interface AppState {
  // 应用信息
  version: string

  // 侧边栏
  sidebarVisible: boolean
  sidebarWidth: number

  // Actions
  setVersion: (v: string) => void
  toggleSidebar: () => void
  setSidebarWidth: (w: number) => void
}

export const useAppStore = create<AppState>((set) => ({
  version: '',
  sidebarVisible: true,
  sidebarWidth: 260,

  setVersion: (v) => set({ version: v }),
  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
}))
