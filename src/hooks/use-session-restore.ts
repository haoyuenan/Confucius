import { useEffect } from 'react'
import { useAppStore } from '../stores/app-store'
import { useTabStore } from '../stores/tab-store'
import { useSidebarStore } from '../stores/sidebar-store'
import { themeService, type ThemeId } from '../services/theme-service'
import { loadSession, subscribeAutoSave } from '../services/workspace-store'
import * as bridge from '../services/electron-bridge'

export function useSessionRestore(newUntitledTab: () => void) {
  useEffect(() => {
    const session = loadSession()
    if (session) {
      themeService.switchTheme(session.theme as ThemeId)
      useAppStore.getState().setSidebarWidth(session.sidebar.width)
      if (!session.sidebar.visible) {
        useAppStore.getState().toggleSidebar()
      }
      useSidebarStore.getState().setActiveTab(session.sidebar.activeTab)
      useSidebarStore.getState().setExpandedPaths(session.sidebar.expandedPaths)

      ;(async () => {
        for (const t of session.tabs) {
          if (t.filePath) {
            try {
              const data = await bridge.readFile(t.filePath)
              useTabStore.getState().openFile(t.filePath, data.content)
            } catch { continue }
          } else {
            useTabStore.getState().newUntitledTab()
          }
        }
        const tabs = useTabStore.getState().tabs
        const idx = Math.min(session.activeTabIndex, tabs.length - 1)
        if (tabs[idx]) useTabStore.getState().activateTab(tabs[idx].id)
      })()
    } else {
      if (useTabStore.getState().tabs.length === 0) {
        newUntitledTab()
      }
    }

    const unsub = subscribeAutoSave()
    return () => unsub()
  }, [newUntitledTab])
}
