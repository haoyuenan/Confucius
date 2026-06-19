import { useTabStore } from '../stores/tab-store'
import { useSidebarStore } from '../stores/sidebar-store'
import { useAppStore } from '../stores/app-store'
import { themeService } from './theme-service'

const STORAGE_KEY = 'confucius-workspace-session'

export interface WorkspaceSession {
  version: 1
  tabs: Array<{
    filePath: string | null
    fileName: string
    scrollTop: number
    cursor: { line: number; col: number }
  }>
  activeTabIndex: number
  sidebar: {
    visible: boolean
    width: number
    activeTab: string
    expandedPaths: string[]
  }
  theme: string
}

// ── Save (synchronous) ──

export function saveSession(): void {
  const tabState = useTabStore.getState()
  const sidebarState = useSidebarStore.getState()
  const appState = useAppStore.getState()

  const session: WorkspaceSession = {
    version: 1,
    tabs: tabState.tabs.map((t) => ({
      filePath: t.filePath,
      fileName: t.fileName,
      scrollTop: t.scrollTop,
      cursor: { line: 1, col: 1 },
    })),
    activeTabIndex: tabState.activeTabId
      ? Math.max(0, tabState.tabs.findIndex((t) => t.id === tabState.activeTabId))
      : 0,
    sidebar: {
      visible: appState.sidebarVisible,
      width: appState.sidebarWidth,
      activeTab: sidebarState.activeTab,
      expandedPaths: Array.from(sidebarState.expandedPaths),
    },
    theme: themeService.getCurrentTheme(),
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch (e) {
    console.warn('[Workspace] save failed:', e)
  }
}

// ── Load ──

export function loadSession(): WorkspaceSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s || !Array.isArray(s.tabs)) return null
    if (s.version !== 1) return null
    return s as WorkspaceSession
  } catch {
    clearSession()
    return null
  }
}

export function clearSession(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
}

// ── Auto-save subscriptions ──

const DEBOUNCE_MS = 500
let saveTimer: ReturnType<typeof setTimeout> | null = null

function debouncedSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveSession, DEBOUNCE_MS)
}

export function subscribeAutoSave(): () => void {
  const unsubs: (() => void)[] = []
  unsubs.push(useTabStore.subscribe(() => debouncedSave()))
  unsubs.push(useAppStore.subscribe(() => debouncedSave()))
  unsubs.push(useSidebarStore.subscribe(() => debouncedSave()))
  // beforeunload 时同步写（不掉数据）
  const beforeUnload = () => saveSession()
  window.addEventListener('beforeunload', beforeUnload)
  return () => {
    unsubs.forEach((fn) => fn())
    window.removeEventListener('beforeunload', beforeUnload)
  }
}
