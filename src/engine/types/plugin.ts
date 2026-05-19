import type { ReactNode } from 'react'

/** 插件元数据 */
export interface PluginManifest {
  id: string
  name: string
  version: string
  apiVersion?: string
  description?: string
  author?: string
  dependencies?: string[]
  permissions?: string[]
}

/** 状态栏条目定义 */
export interface StatusBarItemDef {
  id: string
  priority: number
  component?: ReactNode
  label?: string | (() => string)
}

/** 侧边栏面板定义 */
export interface SidebarTabDef {
  id: string
  label: string
  icon: string
  /** React 组件（内置插件用） */
  component?: ReactNode
  /** DOM 渲染函数（外部 JS 插件用） */
  render?: () => HTMLElement
}

/** 命令定义 */
export interface CommandDef {
  id: string
  label: string
  icon?: string
  execute: () => void
  category?: string
  description?: string
  shortcut?: string
  keywords?: string[]
}

import type { EventName, EventPayload } from '../EventBus'

/** 插件运行时上下文 */
export interface PluginContext {
  getContent(): string
  getCursorPosition(): { line: number; col: number }
  getActiveFilePath(): string | null
  insertText(text: string): void
  addStatusBarItem(item: StatusBarItemDef): () => void
  addSidebarTab(tab: SidebarTabDef): () => void
  addStyle(css: string): () => void
  registerCommand(cmd: CommandDef): () => void
  onContentChange(cb: (content: string) => void): () => void
  console: Pick<Console, 'log' | 'warn' | 'error'>
  /** 事件总线：插件间通信 */
  events: {
    on: <N extends EventName>(event: N, handler: (payload: EventPayload<N>) => void) => () => void
    emit: <N extends EventName>(event: N, payload: EventPayload<N>) => void
  }
}

/** 插件主接口 */
export interface Plugin {
  manifest: PluginManifest
  onActivate?: (ctx: PluginContext) => void
  onDeactivate?: () => void
}
