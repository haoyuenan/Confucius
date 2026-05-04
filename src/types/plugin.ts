import type { EditorView } from 'codemirror'
import type { Extension } from '@codemirror/state'
import type { TabData } from '../stores/tab-store'
import type { ReactNode } from 'react'

/** 插件元数据 */
export interface PluginManifest {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  dependencies?: string[]
}

/** 侧边栏面板定义 */
export interface SidebarTabDef {
  id: string
  label: string
  icon: string
  component: ReactNode
}

/** 状态栏条目定义 */
export interface StatusBarItemDef {
  id: string
  /** 优先级，越大越靠右 */
  priority: number
  component: ReactNode
}

/** 命令定义 */
export interface CommandDef {
  id: string
  label: string
  icon?: string
  execute: () => void
}

/** 插件运行时可访问的系统 API */
export interface PluginContext {
  /** 当前 CM6 EditorView（可能为 null） */
  editorView: EditorView | null
  /** 获取当前活跃标签 */
  activeTab: () => TabData | null
  /** 添加侧边栏面板，返回移除函数 */
  addSidebarTab: (tab: SidebarTabDef) => () => void
  /** 添加状态栏条目，返回移除函数 */
  addStatusBarItem: (item: StatusBarItemDef) => () => void
  /** 注册全局命令 */
  registerCommand: (cmd: CommandDef) => void
  /** 注册 CM6 扩展 */
  registerCmExtension: (ext: Extension) => void
  /** 监听内容变化，返回取消监听函数 */
  onContentChange: (cb: (content: string) => void) => () => void
}

/** 插件主接口 */
export interface Plugin {
  manifest: PluginManifest
  onActivate?: (ctx: PluginContext) => void
  onDeactivate?: () => void
}
