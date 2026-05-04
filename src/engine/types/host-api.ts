import type { StatusBarItemDef, SidebarTabDef } from './plugin'

/**
 * HostAPIBridge — 宿主应用需要实现的接口
 *
 * PluginEngine 通过此接口获取宿主能力，不直接引用任何宿主内部模块
 */
export interface HostAPIBridge {
  // ── 编辑器信息（只读）──
  getEditorContent(): string
  getCursorPosition(): { line: number; col: number }
  getActiveTabFilePath(): string | null

  // ── UI 扩展 ──
  addStatusBarItem(item: StatusBarItemDef): () => void
  addSidebarTab(tab: SidebarTabDef): () => void

  // ── 事件订阅 ──
  onContentChange(cb: (content: string) => void): () => void

  // ── 生命周期 ──
  getAppVersion(): string
  getAPIVersion(): string
}
