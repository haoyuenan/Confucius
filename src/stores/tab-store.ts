import { create } from 'zustand'
import { useEditorStore } from './editor-store'
import { fileNameFromPath } from '../utils/path'
import * as bridge from '../services/electron-bridge'
import i18n from '../i18n/i18n'

export interface TabData {
  id: string
  filePath: string | null
  fileName: string
  content: string
  savedContent: string
  isModified: boolean
  scrollTop: number
}

export interface TabState {
  tabs: TabData[]
  activeTabId: string | null

  /** 获取活跃 tab */
  activeTab: () => TabData | null
  /** 打开文件：已打开则切换，否则新建 */
  openFile: (filePath: string, content: string) => void
  /** 新建未命名标签 */
  newUntitledTab: () => void
  /** 切换到指定标签 */
  activateTab: (tabId: string) => void
  /** 关闭标签 */
  closeTab: (tabId: string) => Promise<boolean>
  /** 更新指定标签的内容 */
  updateContent: (tabId: string, content: string) => void
  /** 标记标签已保存 */
  markTabSaved: (tabId: string) => void
  /** 保存滚动位置 */
  saveScrollTop: (tabId: string, scrollTop: number) => void
}

let _nextId = 1
function genId(): string { return `tab-${_nextId++}` }

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  activeTab: () => {
    const s = get()
    return s.tabs.find(t => t.id === s.activeTabId) ?? null
  },

  openFile: (filePath, content) => {
    const s = get()
    const existing = s.tabs.find(t => t.filePath === filePath)
    if (existing) {
      get().activateTab(existing.id)
      return
    }
    const fileName = fileNameFromPath(filePath)
    const tab: TabData = {
      id: genId(),
      filePath,
      fileName,
      content,
      savedContent: content,
      isModified: false,
      scrollTop: 0,
    }
    set(s => ({ tabs: [...s.tabs, tab] }))
    get().activateTab(tab.id)
  },

  newUntitledTab: () => {
    const tab: TabData = {
      id: genId(),
      filePath: null,
      fileName: `${i18n.t('editor.tab.untitled')}-${_nextId - 1}`,
      content: '',
      savedContent: '',
      isModified: false,
      scrollTop: 0,
    }
    set(s => ({ tabs: [...s.tabs, tab] }))
    get().activateTab(tab.id)
  },

  activateTab: (tabId) => {
    const s = get()
    const newTab = s.tabs.find(t => t.id === tabId)
    if (!newTab) return

    set({ activeTabId: tabId })
    useEditorStore.getState().setContent(newTab.content)
  },

  closeTab: async (tabId) => {
    const s = get()
    const tab = s.tabs.find(t => t.id === tabId)
    if (!tab) return false

    if (tab.isModified) {
      const result = await bridge.confirmSave()
      if (result === 0 && tab.filePath) {
        await bridge.writeFile(tab.filePath, tab.content)
        get().markTabSaved(tab.id)
      } else if (result === 2) {
        return false
      }
    }

    const remaining = s.tabs.filter(t => t.id !== tabId)
    set({ tabs: remaining })

    if (tabId === s.activeTabId) {
      if (remaining.length === 0) {
        get().newUntitledTab()
      } else {
        const idx = s.tabs.findIndex(t => t.id === tabId)
        const next = remaining[Math.min(idx, remaining.length - 1)]
        if (next) get().activateTab(next.id)
      }
    }
    return true
  },

  updateContent: (tabId, content) => {
    set(s => ({
      tabs: s.tabs.map(t =>
        t.id === tabId
          ? { ...t, content, isModified: content !== t.savedContent }
          : t
      ),
    }))
    // 同步到 editorStore，供插件（状态栏字数统计等）读取
    if (tabId === get().activeTabId) {
      useEditorStore.getState().setContent(content)
    }
  },

  markTabSaved: (tabId) => {
    set(s => ({
      tabs: s.tabs.map(t =>
        t.id === tabId ? { ...t, savedContent: t.content, isModified: false } : t
      ),
    }))
  },

  saveScrollTop: (tabId, scrollTop) => {
    set(s => ({
      tabs: s.tabs.map(t =>
        t.id === tabId ? { ...t, scrollTop } : t
      ),
    }))
  },
}))
