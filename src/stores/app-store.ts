import { create } from 'zustand'

interface AppState {
  // 侧边栏
  sidebarVisible: boolean
  sidebarWidth: number

  // Actions
  toggleSidebar: () => void
  setSidebarWidth: (w: number) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarVisible: true,
  sidebarWidth: 260,

  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
}))
