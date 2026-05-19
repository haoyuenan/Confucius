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
  /** React 组件（内置插件用） */
  component?: ReactNode
  /** DOM 渲染函数（外部 JS 插件用） */
  render?: () => HTMLElement
}

/** 状态栏条目定义 — 支持两种模式 */
export interface StatusBarItemDef {
  id: string
  /** 优先级，越大越靠右 */
  priority: number
  /** 模式A：React 组件（内置插件用） */
  component?: ReactNode
  /** 模式B：字符串或字符串生成函数（第三方纯 JS 插件用，每 500ms 轮询更新） */
  label?: string | (() => string)
}

/** 命令定义 */
export interface CommandDef {
  id: string
  label: string
  icon?: string
  execute: () => void
  /** 命令面板用：分组（默认 "文件"、"编辑"、"视图"、"工具" 等） */
  category?: string
  /** 命令面板用：副标题描述 */
  description?: string
  /** 命令面板用：显示快捷键文本（仅显示，不绑定） */
  shortcut?: string
  /** 命令面板用：额外搜索关键词 */
  keywords?: string[]
}

/** 第三方插件上下文（不含 React，适用于外部纯 JS 插件） */
export interface ExternalPluginContext {
  /** 当前编辑器内容 */
  getContent: () => string
  /** 注册状态栏纯文本条目 */
  addStatusBarItem: (item: StatusBarItemDef) => () => void
  /** 注册侧边栏面板（需传入 HTML 字符串） */
  addSidebarTab: (tab: SidebarTabDef) => () => void
  /** 添加自定义样式 */
  addStyle: (css: string) => () => void
  /** 控制台日志（沙箱安全版本） */
  console: Pick<Console, 'log' | 'warn' | 'error'>
}

/** 插件主接口 — 所有插件必须实现此接口 */
export interface Plugin {
  manifest: PluginManifest
  onActivate?: (ctx: PluginContext) => void
  onDeactivate?: () => void
}

/** 插件运行时可访问的系统 API */
export interface PluginContext extends ExternalPluginContext {
  editorView: EditorView | null
  activeTab: () => TabData | null
  registerCommand: (cmd: CommandDef) => void
  registerCmExtension: (ext: Extension) => void
  onContentChange: (cb: (content: string) => void) => () => void
}
