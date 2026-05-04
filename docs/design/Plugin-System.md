# 插件系统设计文档

**版本**：v1.0  
**日期**：2026-05-04  
**状态**：初始设计

---

## 目录

1. [设计目标](#1-设计目标)
2. [总体架构](#2-总体架构)
3. [插件接口定义](#3-插件接口定义)
4. [生命周期管理](#4-生命周期管理)
5. [注册与加载流程](#5-注册与加载流程)
6. [内置插件：字数统计](#6-内置插件字数统计)
7. [扩展机制](#7-扩展机制)
8. [文件清单](#8-文件清单)
9. [验收标准](#9-验收标准)

---

## 1. 设计目标

| 目标 | 说明 |
|------|------|
| **最小侵入** | 插件的注册与卸载不应影响主系统正常运行 |
| **类型安全** | 插件 API 全部使用 TypeScript 接口，编译期检查 |
| **隔离性** | 插件崩溃不会导致主进程或渲染进程崩溃 |
| **可发现** | 插件可通过命令面板或侧边栏发现和触发 |
| **渐进式** | 先支持内置插件，后续支持从文件系统加载第三方插件 |

### 非目标

- 不支持插件 UI 渲染在 iframe 中（首次迭代）
- 不支持插件访问文件系统（通过 bridge 间接访问）
- 不支持热加载/热卸载（首次迭代）

---

## 2. 总体架构

```
┌────────────────────────────────────────────────────────┐
│                     PluginManager                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ 注册表         │  │ 生命周期      │  │ 命令注册表     │  │
│  │ Map<id, Plugin│  │ activate()   │  │ Command[]    │  │
│  │  实例>        │  │ deactivate() │  │              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
└─────────┼─────────────────┼─────────────────┼───────────┘
          │                 │                 │
┌─────────▼─────────────────▼─────────────────▼───────────┐
│                     PluginContext                        │
│  - editorView: EditorView | null                         │
│  - activeTab: () => TabData | null                       │
│  - addSidebarTab(tab): void                              │
│  - addStatusBarItem(item): () => void  (返回移除函数)      │
│  - registerCommand(cmd): void                            │
│  - onContentChange(cb): () => void                       │
└─────────────────────────────────────────────────────────┘
          │                 │                 │
┌─────────▼─────────────────▼─────────────────▼───────────┐
│  Plugin A     │  Plugin B      │  Plugin C (内置)       │
│  (第三方)      │  (第三方)       │  字数统计              │
└───────────────┘ ───────────────┘ ──────────────────────┘
```

### 核心模块职责

| 模块 | 文件 | 职责 |
|------|------|------|
| `PluginManager` | `src/services/plugin-manager.ts` | 插件注册、加载、卸载、命令调度 |
| `PluginContext` | `src/services/plugin-manager.ts` | 插件运行时上下文，封装系统 API |
| `Plugin` 接口 | `src/types/plugin.ts` | 插件必须实现的接口定义 |
| 内置插件 | `src/plugins/builtins/*.ts` | 随系统分发的官方插件 |

---

## 3. 插件接口定义

### 3.1 核心接口

```typescript
// src/types/plugin.ts

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
  /** 依赖的其他插件 ID 列表 */
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
  /** 执行函数 */
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
  /** 监听内容变化 */
  onContentChange: (cb: (content: string) => void) => () => void
}

/** 插件主接口 — 所有插件必须实现此接口 */
export interface Plugin {
  /** 插件元数据 */
  manifest: PluginManifest
  /** 插件激活时调用 */
  onActivate?: (ctx: PluginContext) => void
  /** 插件卸载时调用，清理所有资源 */
  onDeactivate?: () => void
}
```

### 3.2 接口设计说明

| 设计决策 | 理由 |
|---------|------|
| `onActivate` 接收 `PluginContext` 而非全局对象 | 隔离性 — 插件只能通过 Context 访问系统能力 |
| 注册函数返回移除函数（`() => void`） | 插件无需记住注册了什么，`onDeactivate` 时统一清理 |
| `CommandDef.execute` 无参数 | 命令视为全局操作，按 ID 查找执行 |
| `component: ReactNode` | 侧边栏和状态栏支持 React 组件渲染 |

---

## 4. 生命周期管理

### 4.1 状态机

```
         register()
         ┌─────────┐
    ────▶│ REGISTERED│
         └────┬────┘
              │ 系统启动完毕
         ┌────▼────┐
    ────▶│ ACTIVE  │──── onDeactivate() ────▶ 清理资源
         └────┬────┘
              │ 异常
         ┌────▼────┐
         │  ERROR  │
         └─────────┘
```

### 4.2 生命周期钩子

| 钩子 | 触发时机 | 职责 |
|------|---------|------|
| `onActivate(ctx)` | 系统启动后，所有基础模块就绪时 | 注册侧边栏、命令、监听器 |
| `onDeactivate()` | 插件卸载时 | 移除所有监听器、清理 DOM、释放资源 |

### 4.3 自动清理机制

`PluginContext` 的 `addSidebarTab` / `addStatusBarItem` 等方法返回清理函数。`PluginManager` 在 `deactivate()` 时自动调用所有已注册的清理函数，插件无需在 `onDeactivate` 中手动跟踪。

```typescript
class PluginManager {
  private activeCleanups: Map<string, (() => void)[]> = new Map()

  activate(plugin: Plugin): void {
    const ctx = this.createContext(plugin)
    const cleanups: (() => void)[] = []

    // 包装 addSidebarTab 使其自动收集清理函数
    const origAdd = ctx.addSidebarTab
    ctx.addSidebarTab = (tab) => {
      const remove = origAdd(tab)
      cleanups.push(remove)
      return remove
    }

    plugin.onActivate?.(ctx)
    this.activeCleanups.set(plugin.manifest.id, cleanups)
  }

  deactivate(pluginId: string): void {
    const cleanups = this.activeCleanups.get(pluginId)
    cleanups?.forEach(fn => fn())
    this.activeCleanups.delete(pluginId)
  }
}
```

---

## 5. 注册与加载流程

### 5.1 内置插件注册

```typescript
// src/services/plugin-manager.ts

import { WordCountPlugin } from '../plugins/builtins/word-count'

class PluginManager {
  private registry: Map<string, Plugin> = new Map()
  private activeIds: Set<string> = new Set()

  /** 注册插件（注册后不会自动激活） */
  register(plugin: Plugin): void {
    if (this.registry.has(plugin.manifest.id)) {
      console.warn(`插件 ${plugin.manifest.id} 已注册，跳过`)
      return
    }
    this.registry.set(plugin.manifest.id, plugin)
  }

  /** 注册内置插件 */
  registerBuiltins(): void {
    this.register(new WordCountPlugin())
    // 未来在此添加更多内置插件
    // this.register(new EmojiPlugin())
    // this.register(new TocPlugin())
  }

  /** 激活插件 */
  activate(id: string): boolean {
    const plugin = this.registry.get(id)
    if (!plugin) { console.warn(`插件 ${id} 未注册`); return false }
    if (this.activeIds.has(id)) return true  // 已激活

    try {
      plugin.onActivate?.(this.createContext(plugin))
      this.activeIds.add(id)
      return true
    } catch (err) {
      console.error(`插件 ${id} 激活失败:`, err)
      return false
    }
  }

  /** 激活所有已注册的插件 */
  activateAll(): void {
    this.registry.forEach((_, id) => this.activate(id))
  }
}
```

### 5.2 加载时序

```
App 初始化
├── 创建 PluginManager 单例
├── 注册内置插件 (registerBuiltins)
├── 创建 PluginContext（此时基础模块已就绪）
│   ├── editorView 引用（通过 active-view.ts）
│   ├── tabStore 引用（直接 import）
│   └── sidebar 引用（通过 addSidebarTab 回调）
├── 激活所有插件 (activateAll)
│   ├── WordCountPlugin.onActivate(ctx)
│   │   ├── ctx.addStatusBarItem(...)  → 注册状态栏组件
│   │   ├── ctx.onContentChange(...)   → 监听内容变化
│   │   └── done
│   └── 其他插件...
└── React 渲染
    ├── <App />
    │   ├── <Sidebar />          (含插件注册的面板)
    │   ├── <EditorLayout />
    │   ├── <ModeSwitch />
    │   └── <StatusBar />         (含插件注册的状态栏条目)
    └── 完成
```

### 5.3 第三方插件加载（预留接口）

```typescript
// 未来 Phase 实现

async loadExternalPlugin(path: string): Promise<boolean> {
  try {
    const module = await import(/* @vite-ignore */ path)
    const plugin: Plugin = module.default
    if (!plugin?.manifest?.id) {
      console.warn(`外部插件格式无效: ${path}`)
      return false
    }
    this.register(plugin)
    this.activate(plugin.manifest.id)
    return true
  } catch (err) {
    console.error(`加载外部插件失败 ${path}:`, err)
    return false
  }
}
```

---

## 6. 内置插件：字数统计

### 6.1 功能需求

| 需求 | 说明 |
|------|------|
| **字数统计** | 实时显示当前文档的字数（中文字数 + 英文单词数） |
| **行数统计** | 实时显示当前文档的行数 |
| **选中统计** | 选中文本时，显示选中字数 / 全文字数 |
| **显示位置** | 状态栏右侧（编辑器底部） |
| **格式** | `字数: 1,234 行: 56` 或 `字数: 234/1,234 行: 56`（有选中时） |

### 6.2 字数计算算法

```typescript
// src/plugins/builtins/word-count.ts

function countWords(text: string): { chars: number; words: number; lines: number } {
  const chars = text.length
  const lines = text.split('\n').length

  // 中文计数：每个中文字符计为 1 字
  // 英文计数：按空格/标点分隔的 token 计为 1 词
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length
  const englishText = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ')
  const englishWords = englishText
    .split(/[\s,;.!?()\[\]{}""''：；。！？（）【】“”‘’]+/)
    .filter(Boolean)
    .length

  // 总字数 = 中文字符数 + 英文词数
  const words = chineseChars + englishWords

  return { chars, words, lines }
}
```

### 6.3 状态栏组件

```tsx
// src/components/Editor/StatusBar.tsx

import { useEditorStore } from '../../stores/editor-store'
import { useTabStore } from '../../stores/tab-store'
// 状态栏组件会渲染所有注册的状态栏条目，
// 字数统计通过插件系统注册一个条目

function StatusBar() {
  const statusItems = usePluginStore(s => s.statusItems)  // 由 PluginManager 维护

  return (
    <div className="status-bar">
      {/* 左侧区域 */}
      <div className="status-left" />
      {/* 右侧区域 - 插件按 priority 排序 */}
      <div className="status-right">
        {statusItems
          .sort((a, b) => b.priority - a.priority)
          .map(item => (
            <span key={item.id} className="status-item">{item.component}</span>
          ))
        }
      </div>
    </div>
  )
}
```

### 6.4 插件实现

```typescript
// src/plugins/builtins/word-count.ts

import type { Plugin, PluginContext } from '../../types/plugin'

export class WordCountPlugin implements Plugin {
  manifest = {
    id: 'builtin:word-count',
    name: '字数统计',
    version: '1.0.0',
    description: '实时显示文档字数、行数和选中字数',
  }

  private currentContent = ''
  private selectedText = ''
  private removeStatusItem: (() => void) | null = null
  private removeContentListener: (() => void) | null = null

  /** 字数统计组件（React 函数组件） */
  private WordCountComponent = () => {
    // 使用 React hooks 实时统计
    const { useState, useEffect } = require('react')

    const [stats, setStats] = useState({ chars: 0, words: 0, lines: 1, selected: 0 })

    useEffect(() => {
      const updateStats = () => {
        const text = this.currentContent
        const selection = this.selectedText
        const chars = text.length
        const lines = text.split('\n').length

        // 字数计算
        const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
        const englishWords = text
          .replace(/[\u4e00-\u9fff]/g, ' ')
          .split(/[\s,;.!?()\[\]{}""'':：；。！？（）【】“”]+/)
          .filter(Boolean).length

        const words = chineseChars + englishWords
        const selected = selection.length

        setStats({ chars, words, lines, selected })
      }

      // 使用 requestAnimationFrame 防抖
      let raf = 0
      const observer = new MutationObserver(() => {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(updateStats)
      })

      updateStats()
      // 观察编辑器内容变化
      const editorEl = document.querySelector('.cm-content')
      if (editorEl) observer.observe(editorEl, { childList: true, subtree: true, characterData: true })

      return () => observer.disconnect()
    }, [])

    if (stats.selected > 0) {
      return `字数: ${stats.selected.toLocaleString()}/${stats.words.toLocaleString()}  行: ${stats.lines}`
    }
    return `字数: ${stats.words.toLocaleString()}  行: ${stats.lines}`
  }

  onActivate(ctx: PluginContext): void {
    // 监听内容变化
    this.removeContentListener = ctx.onContentChange((content) => {
      this.currentContent = content
    })

    // 监听选中变化
    document.addEventListener('selectionchange', this.handleSelectionChange)

    // 注册状态栏条目
    this.removeStatusItem = ctx.addStatusBarItem({
      id: 'word-count',
      priority: 10,
      component: <this.WordCountComponent />,
    })
  }

  onDeactivate(): void {
    this.removeStatusItem?.()
    this.removeContentListener?.()
    document.removeEventListener('selectionchange', this.handleSelectionChange)
  }

  private handleSelectionChange = (): void => {
    const sel = window.getSelection()
    this.selectedText = sel?.toString() ?? ''
  }
}
```

### 6.5 数据流

```
用户输入 / 切换文件
  │
  ▼
EditorStore.content 更新
  │
  ▼
PluginManager.onContentChange 回调
  │
  ▼
WordCountPlugin 收到新内容
  │
  ▼
状态栏组件重新渲染（React 状态驱动）
  │
  ▼
显示: "字数: 1,234  行: 56"
```

### 6.6 替代简化方案（首次迭代）

实际情况中，字数统计组件需要用真实的 React API 而非 `require('react')`。更简洁的方式：字数统计插件通过 `onContentChange` 收集内容，然后触发一个自定义事件，由 `StatusBar` 组件监听。

但在最简实现中，我们可以让 `StatusBar` 成为一个纯容器组件，插件通过 `PluginContext.addStatusBarItem` 注入 React 组件引用。组件内部通过 Zustand store 获取内容。

最简实现：字数统计插件注册一个 React 组件，该组件直接从 `useEditorStore` / `useTabStore` 读取内容，无需插件手动跟踪。

```tsx
// 简化的字数统计组件（直接读 store）
function WordCountDisplay() {
  const content = useEditorStore((s) => s.content)
  const [selected, setSelected] = useState('')

  useEffect(() => {
    const handler = () => setSelected(window.getSelection()?.toString() ?? '')
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [])

  const words = countWords(content)
  const parts = [`字数: ${words.toLocaleString()}`, `行: ${words.lines}`]
  if (selected) parts.unshift(`选中: ${selected.length}`)

  return <>{parts.join('  ')}</>
}
```

---

## 7. 扩展机制

### 7.1 当前扩展点

| 扩展点 | 接口 | 示例 |
|--------|------|------|
| **侧边栏面板** | `ctx.addSidebarTab()` | 字数统计详情面板 |
| **状态栏条目** | `ctx.addStatusBarItem()` | 字数统计、模式指示器 |
| **全局命令** | `ctx.registerCommand()` | 字数统计详情、格式化文档 |
| **CM6 扩展** | `ctx.registerCmExtension()` | 自定义高亮、补全 |
| **内容监听** | `ctx.onContentChange()` | 字数统计、自动保存 |

### 7.2 未来扩展点（预留）

| 扩展点 | 接口 | 说明 |
|--------|------|------|
| markdown-it 插件 | `ctx.registerMdPlugin()` | 添加 Markdown 渲染规则 |
| 工具栏按钮 | `ctx.addToolbarButton()` | 在格式工具栏添加按钮 |
| 文件操作钩子 | `ctx.onFileSave()` | 保存前/后处理 |
| 自定义主题 | `ctx.registerTheme()` | 注册 CSS 变量主题 |
| 语言语法 | `ctx.registerLanguage()` | 注册 CM6 LanguageSupport |

### 7.3 插件通信

插件间通过 `PluginManager` 间接通信：

```typescript
// PluginManager 提供查询接口
class PluginManager {
  /** 获取插件运行时数据 */
  getPluginData<T>(id: string): T | null {
    return this.pluginData.get(id) as T ?? null
  }

  /** 设置插件运行时数据（供其他插件读取） */
  setPluginData(id: string, data: unknown): void {
    this.pluginData.set(id, data)
  }
}
```

---

## 8. 文件清单

### 新增文件（6 个）

| 文件 | 说明 |
|------|------|
| `src/types/plugin.ts` | 插件类型定义（接口、上下文、命令） |
| `src/services/plugin-manager.ts` | 插件管理器（注册、加载、生命周期、上下文创建） |
| `src/stores/plugin-store.ts` | 插件状态 store（侧边栏面板列表、状态栏条目列表） |
| `src/plugins/builtins/word-count.ts` | 内置字数统计插件 |
| `src/components/Editor/StatusBar.tsx` | 状态栏容器组件 |
| `src/styles/status-bar.css` | 状态栏样式 |

### 修改文件（3 个）

| 文件 | 变更 |
|------|------|
| `src/App.tsx` | 初始化 PluginManager、注册内置插件、渲染 `<StatusBar />` |
| `src/main.tsx` | 导入 `status-bar.css` |
| `src/editor/active-view.ts` | 添加 CM6 EditorView 通知插件管理器的机制（可选） |

---

## 9. 验收标准

| # | 验收项 | 验证方式 |
|---|--------|---------|
| 1 | PluginManager 单例可正常创建 | 控制台无报错 |
| 2 | `register()` 注册插件后 registry 包含该插件 | 单元测试 |
| 3 | `activateAll()` 激活所有插件 | 字数统计出现在状态栏 |
| 4 | 字数统计显示正确字数 | 输入 100 个字符 → 显示 "字数: 100" |
| 5 | 选中文本显示选中字数 | 选中 10 个字符 → 显示 "选中: 10  字数: 100" |
| 6 | 切换文件后字数自动更新 | 打开不同文件，字数变化 |
| 7 | `onDeactivate()` 清理所有资源 | 卸载插件后状态栏条目消失 |
| 8 | 插件激活异常不阻塞其他插件 | try-catch 隔离 |
| 9 | 类型检查零错误 | `tsc --noEmit` 通过 |
| 10 | 122 测试通过 | `vitest run` 全部通过 |
