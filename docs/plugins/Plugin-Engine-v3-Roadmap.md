# 插件系统重构增强方案

**版本**：v3.0（重构设计）  
**日期**：2026-05-04  
**状态**：分析/设计

---

## 目录

- [1. 现状问题清单](#1-现状问题清单)
- [2. 目标架构](#2-目标架构)
- [3. 模块化拆分](#3-模块化拆分)
- [4. 插件发现机制](#4-插件发现机制)
- [5. API 版本化与兼容性](#5-api-版本化与兼容性)
- [6. 依赖管理](#6-依赖管理)
- [7. 热插拔与生命周期增强](#7-热插拔与生命周期增强)
- [8. 错误隔离](#8-错误隔离)
- [9. 插件间通信](#9-插件间通信)
- [10. 配置持久化](#10-配置持久化)
- [11. 迁移路径](#11-迁移路径)
- [12. 文件清单](#12-文件清单)

---

## 1. 现状问题清单

| # | 问题 | 严重度 | 说明 |
|---|------|--------|------|
| 1 | **硬编码依赖宿主模块** | ⚠️ 高 | `PluginManager` 直接 `import` 了 `useTabStore`、`usePluginStore`、`getActiveView`。插件系统与宿主代码高度耦合，更换宿主版本可能导致插件系统无法工作 |
| 2 | **无自动发现** | ⚠️ 高 | 内置插件需要在 `App.tsx` 中手动 `import` 并传递给 `registerBuiltins()`。新增插件必须修改系统核心源码 |
| 3 | **无依赖管理** | ⚠️ 中 | `manifest.dependencies` 已定义但未使用。插件 A 依赖插件 B 时，如果 B 未加载，A 激活会失败 |
| 4 | **无版本兼容检查** | ⚠️ 中 | 无 API 版本声明。宿主升级后旧插件可能因 API 变更而静默失效 |
| 5 | **Context 设计不足** | ⚠️ 中 | `PluginContext` 直接暴露内部实现（如 `editorView` 来自 `active-view.ts`），破坏了封装 |
| 6 | **热插拔不完整** | ⚠️ 中 | `activate` / `deactivate` 已实现但未收集和清理所有资源。`addStyle` 创建的 `<style>` 标签激活时生成、卸载时删除，但事件监听器需要插件自行管理 |
| 7 | **无插件间通信** | ⚠️ 中 | 插件之间无法相互通信。例如字数统计插件无法通知其他插件内容已变化 |
| 8 | **配置无持久化** | ⚠️ 低 | 插件配置（如开关状态、用户设置）不保存。重启后插件需要重新加载 |
| 9 | **加载方式单一** | ✅ 低 | 仅支持通过 `dialog:open-plugin` 文件对话框逐个加载。不支持从目录批量扫描 |
| 10 | **沙箱太弱** | ⚠️ 低 | `new Function` 沙箱仅隔离了参数，插件仍可访问 `window`、`document`、`localStorage` 等全部全局 API |

---

## 2. 目标架构

```
┌──────────────────────────────────────────────────────────┐
│                     宿主应用                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │  宿主 API 层 (HostAPI)                              │  │
│  │  ┌─────────────┐ ┌──────────────┐ ┌─────────────┐ │  │
│  │  │ EditorAPI   │ │  UIAPI       │ │  FileAPI    │ │  │
│  │  │ (只读/安全)  │ │ (侧边栏/状态栏)│ │ (只读文件)  │ │  │
│  │  └─────────────┘ └──────────────┘ └─────────────┘ │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │ 通过 HostAPIBridge 暴露        │
│  ┌──────────────────────▼─────────────────────────────┐  │
│  │  PluginEngine — 插件引擎（完全解耦）                  │  │
│  │                                                     │  │
│  │  ┌──────────┐ ┌───────────┐ ┌──────────────────┐  │  │
│  │  │ Scanner   │ │ Registry  │ │ LifecycleManager │  │  │
│  │  │ 发现插件   │ │ 注册表     │ │ 状态机           │  │  │
│  │  └────┬─────┘ └─────┬─────┘ └────────┬─────────┘  │  │
│  │       │              │                │            │  │
│  │  ┌────▼──────────────▼────────────────▼─────────┐  │  │
│  │  │            PluginSandbox                      │  │  │
│  │  │  new Function / Web Worker / iframe 沙箱     │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  │                                                     │  │
│  │  ┌──────────┐ ┌───────────┐ ┌──────────────────┐  │  │
│  │  │ ConfigDB │ │ EventBus  │ │ DependencyGraph  │  │  │
│  │  │ 配置持久化│ │ 插件间通信 │ │ 依赖解析          │  │  │
│  │  └──────────┘ └───────────┘ └──────────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 核心设计原则

| 原则 | 当前架构 | 目标架构 |
|------|---------|---------|
| **解耦** | `PluginManager` 直接 import 宿主模块 | `PluginEngine` 通过 `HostAPIBridge` 接口与宿主通信 |
| **发现** | 手动 `import` + `register()` | 自动扫描 `~/.confucius/plugins/` 目录 |
| **沙箱** | `new Function` 裸执行 | `new Function` + 白名单 API 注入 |
| **持久化** | 无 | `ConfigDB` 保存插件配置至 `localStorage` |
| **通信** | 无 | `EventBus` 支持插件间事件发布/订阅 |
| **兼容性** | 无版本检查 | `HostAPI` 版本化，插件声明 `apiVersion` |

---

## 3. 模块化拆分

### 3.1 文件结构

```
src/engine/
├── PluginEngine.ts          # 引擎入口：协调所有子模块
├── HostAPIBridge.ts         # 宿主 API 的适配层（解耦关键）
├── Scanner.ts               # 插件发现：扫描目录 / 用户选择
├── Registry.ts               # 插件注册表
├── LifecycleManager.ts       # 生命周期状态机
├── SandboxFactory.ts         # 沙箱工厂
├── DependencyGraph.ts        # 依赖图 + 拓扑排序
├── EventBus.ts               # 插件间事件总线
├── ConfigDB.ts               # 配置持久化存储
│
├── types/
│   ├── plugin.ts             # Plugin / Manifest 接口
│   ├── host-api.ts           # HostAPI 接口定义（宿主需实现）
│   ├── sandbox.ts            # 沙箱接口
│   └── events.ts             # 事件类型定义
│
└── builtins/                 # 内置插件（不依赖 engine/ 内部模块）
    ├── status-bar.ts         # 状态栏信息插件
    └── ...
```

**关键解耦点**：`PluginEngine` 不 import 任何 `src/stores/`、`src/editor/`、`src/components/` 中的代码。它通过 `HostAPIBridge` 获取宿主能力，宿主通过 `HostAPIBridge` 构造函数注入依赖。

### 3.2 HostAPIBridge — 解耦的核心

```typescript
// src/engine/HostAPIBridge.ts
//
// 职责：宿主应用实现此接口并注入到 PluginEngine
// PluginEngine 不直接引用任何宿主代码

export interface HostAPIBridge {
  // ── 编辑器 ──
  getEditorContent(): string
  getCursorPosition(): { line: number; col: number }
  getActiveTabFilePath(): string | null

  // ── UI 扩展 ──
  addStatusBarItem(item: StatusBarItemDef): () => void
  addSidebarTab(tab: SidebarTabDef): () => void
  addToolbarButton(btn: ToolbarButtonDef): () => void

  // ── 事件 ──
  onContentChange(cb: (content: string) => void): () => void
  onFileOpen(cb: (path: string) => void): () => void
  onFileSave(cb: (path: string, content: string) => void): () => void

  // ── 生命周期 ──
  getAppVersion(): string
  getAPIVersion(): string    // API 版本，用于兼容性检查
}
```

宿主应用在 `main.ts` 或 `App.tsx` 中实现此接口并注入：

```typescript
// src/engine/setup.ts
import { PluginEngine } from './PluginEngine'
import * as bridge from './HostAPIBridge'

const engine = new PluginEngine({
  bridge: new HostAPIBridgeImpl(),    // 宿主实现
  pluginDir: '~/.confucius/plugins/', // 插件目录
})

engine.start()  // 启动引擎（扫描 → 注册 → 按依赖排序 → 激活）
```

### 3.3 依赖关系图

```
                    ┌─────────────┐
                    │  PluginEngine │
                    └──────┬──────┘
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌──────────┐    ┌─────────────┐    ┌──────────┐
   │ Scanner   │    │ Registry    │    │ Lifecycle│
   └─────┬────┘    └──────┬──────┘    └────┬─────┘
         │                │                │
         ▼                ▼                ▼
   ┌──────────┐    ┌─────────────┐    ┌──────────┐
   │ Sandbox  │    │ DepGraph   │    │ EventBus │
   └──────────┘    └─────────────┘    └──────────┘
```

依赖方向：`PluginEngine → 所有子模块`。子模块之间不互相引用。

---

## 4. 插件发现机制

### 4.1 目录约定

```
~/.confucius/plugins/           ← 用户插件根目录
├── my-emoji-plugin/            ← 每个插件独立子目录
│   ├── manifest.json           ← 元数据（必须）
│   ├── index.js                ← 入口（必须）
│   ├── style.css               ← 样式（可选）
│   └── assets/                 ← 资源（可选）
│       └── icon.png
│
├── doc-exporter/
│   └── index.js
│
└── disabled/                   ← 被用户禁用的插件移入此目录
```

### 4.2 manifest.json 规范

```json
{
  "id": "my-emoji-plugin",
  "name": "Emoji 插件",
  "version": "1.2.0",
  "apiVersion": "^1.0.0",
  "description": "在编辑器中输入 :smile: 自动转换为 😄",
  "author": "Community",
  "license": "MIT",
  "entry": "index.js",
  "style": "style.css",
  "dependencies": {
    "emoji-data": "^2.0.0"
  },
  "optionalDependencies": {},
  "permissions": [
    "editor:modify",
    "ui:statusbar"
  ],
  "configSchema": {
    "type": "object",
    "properties": {
      "autoComplete": {
        "type": "boolean",
        "default": true,
        "description": "输入 : 时自动弹出 Emoji 选择器"
      }
    }
  }
}
```

### 4.3 Scanner 自动发现

```typescript
class Scanner {
  async scanDirectory(dirPath: string): Promise<PluginPackage[]> {
    // 1. 读取 ~/.confucius/plugins/ 下的所有子目录
    // 2. 每个子目录读取 manifest.json
    // 3. 校验 manifest 格式
    // 4. 收集为 PluginPackage[]
    // 5. 跳过 disabled/ 目录下的插件
  }

  async loadPackage(pkg: PluginPackage): Promise<Plugin | null> {
    // 1. 读取入口文件内容
    // 2. 通过 SandboxFactory 沙箱执行
    // 3. 返回 Plugin 实例
  }

  watchDirectory(dirPath: string): () => void {
    // fs.watch 监听插件目录变化
    // 新增 → 自动加载
    // 删除 → 自动卸载
    // 返回清理函数
  }
}
```

### 4.4 内置插件注册方式变更

**当前**：在 `App.tsx` 中手动 import 并注册：

```typescript
// ❌ 当前：修改核心源码才能添加内置插件
import { StatusBarPlugin } from './plugins/builtins/status-bar-info'
pluginManager.registerBuiltins([new StatusBarPlugin()])
```

**目标**：内置插件放在 `plugins/builtins/` 目录，引擎自动扫描：

```typescript
// ✅ 目标：引擎启动时自动扫描
// PluginEngine 初始化时扫描两个位置：
// 1. 应用内置的 plugins/builtins/ 目录
// 2. 用户目录 ~/.confucius/plugins/

const engine = new PluginEngine({
  builtinDir: path.join(appRoot, 'plugins', 'builtins'),
  userDir: path.join(homeDir, '.confucius', 'plugins'),
})
engine.start()  // 自动发现所有插件
```

---

## 5. API 版本化与兼容性

### 5.1 API 版本声明

```typescript
// src/engine/types/host-api.ts

const HOST_API_VERSION = '1.0.0'  // 宿主 API 版本

interface HostAPIVersion {
  major: number
  minor: number
  patch: number
}

function parseVersion(v: string): HostAPIVersion {
  const [major, minor, patch] = v.split('.').map(Number)
  return { major, minor, patch }
}

function satisfies(required: string, provided: string): boolean {
  const req = parseVersion(required)
  const prov = parseVersion(provided)
  // ^1.0.0 → major 必须匹配，minor >= 0
  if (required.startsWith('^')) {
    return prov.major === req.major && prov.minor >= req.minor
  }
  // ~1.0.0 → major.minor 必须匹配，patch >= 0
  if (required.startsWith('~')) {
    return prov.major === req.major && prov.minor === req.minor
  }
  // 精确
  return prov.major === req.major && prov.minor === req.minor && prov.patch >= req.patch
}
```

### 5.2 版本不匹配时的行为

| 插件声明的 apiVersion | 宿主 API 版本 | 行为 |
|----------------------|--------------|------|
| `^1.0.0` | `1.2.0` | ✅ 加载（major 匹配） |
| `^1.0.0` | `2.0.0` | ❌ 拒绝（major 不匹配） |
| `~1.0.0` | `1.1.0` | ❌ 拒绝（minor 不匹配） |
| `^1.0.0` | `1.0.0` | ✅ 加载 |
| 未声明 | 任意 | ⚠️ 警告后加载（假设兼容） |

---

## 6. 依赖管理

### 6.1 依赖图

```typescript
class DependencyGraph {
  private edges: Map<string, Set<string>> = new Map()

  addDependency(from: string, to: string, optional: boolean): void {
    // from 依赖 to
  }

  /** 拓扑排序，返回按依赖顺序排列的 ID 列表 */
  resolveOrder(ids: string[]): string[] {
    // Kahn 算法
    // 检测到循环依赖时抛出带路径的错误
  }

  /** 检查缺失的依赖 */
  findMissing(pluginId: string): string[] {
    // 返回已声明但未注册的依赖 ID
  }
}
```

### 6.2 加载顺序流程

```
用户加载插件 A（依赖 B 和 C）
  1. DependencyGraph.register(A)
  2. 检查 A 的依赖 → 需要 B 和 C
  3. DependencyGraph.findMissing(A) → 检查 B 和 C 是否已注册
  4a. B 和 C 已注册 → 拓扑排序 → [C, B, A]
  4b. B 未注册 → 提示用户"需要先加载插件 B"
  5. 按 [C, B, A] 顺序依次 activate()
```

---

## 7. 热插拔与生命周期增强

### 7.1 增强的生命周期

```typescript
enum PluginStatus {
  DISCOVERED  = 'discovered',   // 文件系统发现
  LOADING     = 'loading',      // 正在加载代码
  LOADED      = 'loaded',       // 代码加载完成，等待激活
  ACTIVATING  = 'activating',   // 正在激活（异步）
  ACTIVE      = 'active',       // 运行中
  DEACTIVATING= 'deactivating', // 正在卸载
  INACTIVE    = 'inactive',     // 已卸载
  ERROR       = 'error',        // 异常
  REMOVED     = 'removed',      // 已从文件系统删除
}
```

### 7.2 热插拔流程

```
文件系统新增插件目录
  → Scanner 检测到
  → 读取 manifest.json
  → 验证格式和 apiVersion
  → 检查依赖是否满足
  → 加载入口代码（SandboxFactory）
  → 注册到 Registry
  → 触发 'plugin:registered' 事件
  → 自动激活（如果用户设置允许）
  → 触发 'plugin:activated' 事件
  → UI 通知用户（状态栏提示 + 通知）

文件系统删除插件目录
  → Scanner 检测到
  → 标记为 REMOVED
  → 调用 deactivate()
  → 触发 'plugin:deactivated' 事件
  → 通知依赖该插件的其他插件

用户切换插件开关
  → 启用 → activate()
  → 禁用 → deactivate()
```

### 7.3 资源自动追踪

```typescript
// 当前：插件需要手动管理 cleanups
// 目标：PluginEngine 自动追踪所有注册的资源

class ResourceTracker {
  private resources: Map<string, Set<() => void>> = new Map()

  /** 添加资源并返回清除函数 */
  track(pluginId: string, disposer: () => void): void {
    if (!this.resources.has(pluginId)) {
      this.resources.set(pluginId, new Set())
    }
    this.resources.get(pluginId)!.add(disposer)
  }

  /** 清理插件所有资源 */
  disposeAll(pluginId: string): void {
    this.resources.get(pluginId)?.forEach(fn => fn())
    this.resources.delete(pluginId)
  }
}
```

宿主 API 的每个注册方法自动使用 `ResourceTracker`：

```typescript
// 插件只需调用 addStatusBarItem，无需存储清理函数
ctx.addStatusBarItem({ id: 'my-item', priority: 5, label: 'hello' })
// → 内部自动调用 tracker.track(pluginId, remove)
// → 卸载时自动调用 remove，无需插件手动处理
```

---

## 8. 错误隔离

### 8.1 多层隔离

```
层 1：PluginEngine 级别
  → try-catch 包裹所有插件操作
  → 单个插件崩溃不影响引擎和其他插件

层 2：PluginSandbox 级别
  → 限制插件能访问的全局 API
  → 提供白名单 console
  → 阻止插件操作 DOM 的能力（可选）

层 3：iframe 级别（未来）
  → 插件运行在 iframe 中
  → 完全隔离：插件无法访问宿主 DOM
  → 通过 postMessage 通信
```

### 8.2 错误报告

```typescript
interface PluginError {
  pluginId: string
  type: 'activation' | 'runtime' | 'deactivation'
  message: string
  stack?: string
  timestamp: number
}

class ErrorCollector {
  private errors: PluginError[] = []

  record(error: PluginError): void {
    this.errors.push(error)
    console.error(`[插件 ${error.pluginId}] ${error.type}: ${error.message}`)
    // 发送到 UI（状态栏显示错误图标）
    EventBus.emit('plugin:error', error)
  }

  /** 获取插件的错误历史 */
  getErrors(pluginId: string): PluginError[] {
    return this.errors.filter(e => e.pluginId === pluginId)
  }

  /** 获取全部错误 */
  getAll(): PluginError[] { return [...this.errors] }
}
```

### 8.3 沙箱增强

```typescript
class SandboxFactory {
  createSandbox(manifest: PluginManifest): { execute: (code: string) => any } {
    // 创建安全的全局对象白名单
    const safeGlobals = {
      console: { log: console.log, warn: console.warn, error: console.error },
      JSON: JSON,
      Math: Math,
      Date: Date,
      Array: Array,
      Object: Object,
      String: String,
      Number: Number,
      Boolean: Boolean,
      RegExp: RegExp,
      Map: Map,
      Set: Set,
      parseInt, parseFloat,
      encodeURI, decodeURI,
      setTimeout, clearTimeout,
      setInterval, clearInterval,
    }

    const code = `
      const __sandbox = ${JSON.stringify(safeGlobals)};
      with (__sandbox) {
        ${pluginCode}
      }
    `

    // 或者使用 Proxy 拦截全局访问
    return {
      execute: (code) => {
        const fn = new Function('module', 'exports', code)
        // 拦截不需要的全局 API
        const handler = {
          has: () => true,  // 让 undefined 检查通过
          get: (target, prop) => {
            if (prop in safeGlobals) return (safeGlobals as any)[prop]
            if (['window', 'document', 'localStorage', 'fetch', 'XMLHttpRequest'].includes(prop as string)) {
              return undefined  // 不提供敏感 API
            }
            return (target as any)[prop]
          },
        }
        const sandboxGlobal = new Proxy(globalThis, handler)
        fn.call(sandboxGlobal, sandbox.module, sandbox.exports)
      },
    }
  }
}
```

---

## 9. 插件间通信

### 9.1 事件总线

```typescript
class EventBus {
  private listeners: Map<string, Set<{ pluginId: string; handler: Function }>> = new Map()

  /** 订阅事件 */
  on(pluginId: string, event: string, handler: Function): () => void {
    // 注册监听器，返回取消函数
  }

  /** 发布事件 */
  emit(event: string, payload?: any): void {
    // 通知所有订阅者（不包括发布者自身）
  }

  /** 清除插件的所有订阅 */
  removeAll(pluginId: string): void {
    // 插件卸载时自动调用
  }
}
```

### 9.2 内置事件类型

```typescript
// src/engine/types/events.ts

export const PluginEvents = {
  /** 文件操作 */
  'file:opened':      (path: string) => void
  'file:saved':       (path: string, content: string) => void
  'file:closed':      (path: string) => void

  /** 编辑器 */
  'editor:content-change': (content: string) => void
  'editor:cursor-move':    (line: number, col: number) => void
  'editor:selection-change': (text: string) => void

  /** 主题 */
  'theme:switched':   (theme: string) => void

  /** 模式 */
  'mode:switched':    (mode: string) => void

  /** 应用 */
  'app:ready':        () => void
  'app:before-quit':  () => void

  /** 插件 */
  'plugin:activated':   (id: string) => void
  'plugin:deactivated': (id: string) => void
  'plugin:error':       (error: PluginError) => void
}
```

### 9.3 使用示例

```javascript
// 统计插件监听文件保存事件，记录写入字数
ctx.events.on('file:saved', function (path, content) {
  ctx.console.log('保存文件字数:', content.length)
})
```

---

## 10. 配置持久化

### 10.1 ConfigDB

```typescript
class ConfigDB {
  private STORAGE_KEY = 'confucius:plugin-config'

  /** 读取插件配置（合并默认值） */
  get(pluginId: string): PluginConfig {
    const saved = this.loadFromStorage()
    const defaults = this.getDefaults(pluginId)
    return { ...defaults, ...saved[pluginId] }
  }

  /** 写入插件配置项 */
  set(pluginId: string, key: string, value: any): void {
    const saved = this.loadFromStorage()
    saved[pluginId] = saved[pluginId] || {}
    saved[pluginId][key] = value
    this.saveToStorage(saved)
  }

  /** 插件启用状态 */
  isEnabled(pluginId: string): boolean {
    return this.get(pluginId).enabled !== false
  }

  setEnabled(pluginId: string, enabled: boolean): void {
    this.set(pluginId, 'enabled', enabled)
  }

  private loadFromStorage(): Record<string, any> {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}')
    } catch {
      return {}
    }
  }

  private saveToStorage(data: Record<string, any>): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
  }

  /** 每次启动时自动恢复上次加载的插件列表 */
  getAutoLoadPluginIds(): string[] {
    return Object.entries(this.loadFromStorage())
      .filter(([_, cfg]) => (cfg as any).enabled !== false)
      .map(([id]) => id)
  }
}
```

### 10.2 启动恢复流程

```
1. PluginEngine.start()
2. ConfigDB.getAutoLoadPluginIds() → 获取上次启用的插件 ID 列表
3. Scanner 扫描插件目录 → 获取所有可用插件
4. 交集 = 可用 ∩ 上次启用
5. 依赖解析 → 拓扑排序
6. 按顺序 activate()
7. 每个插件读取自己的配置 → 应用到运行时
```

---

## 11. 迁移路径

### Phase 1 — 解耦 PluginManager（2-3h）

| 步骤 | 变更 | 产出 |
|------|------|------|
| 1 | 新建 `engine/types/host-api.ts`，定义 `HostAPIBridge` 接口 | 接口定义 |
| 2 | 新建 `engine/HostAPIBridge.ts`，将当前 `createContext` 中的逻辑抽取为适配器实现 | 适配器 |
| 3 | 新建 `engine/PluginEngine.ts`，接收 `HostAPIBridge` 作为构造参数 | 解耦的引擎 |
| 4 | 修改 `App.tsx`：创建 `HostAPIBridgeImpl` → 注入 `PluginEngine` → 调用 `start()` | 集成 |
| 5 | 删除旧的 `plugin-manager.ts`、`plugin-store.ts` | 清理 |

### Phase 2 — 自动发现 + 目录扫描（2h）

| 步骤 | 变更 | 产出 |
|------|------|------|
| 1 | 新建 `engine/Scanner.ts` | 目录扫描器 |
| 2 | 内置插件放到 `plugins/builtins/` | 目录化 |
| 3 | `PluginEngine.start()` 自动扫描两个目录 | 零配置发现 |
| 4 | 修改 `PluginManagerDialog` 支持批量管理 | UI 更新 |

### Phase 3 — 依赖管理 + 事件总线（2h）

| 步骤 | 变更 | 产出 |
|------|------|------|
| 1 | 新建 `engine/DependencyGraph.ts` | 依赖图 |
| 2 | 新建 `engine/EventBus.ts` | 事件总线 |
| 3 | 整合到 `PluginEngine` 生命周期 | 完整依赖解析 |
| 4 | 插件 `ctx` 中暴露 `events` API | 插件可通信 |

### Phase 4 — 配置持久化 + 沙箱增强（2h）

| 步骤 | 变更 | 产出 |
|------|------|------|
| 1 | 新建 `engine/ConfigDB.ts` | 配置持久化 |
| 2 | `PluginEngine` 启动时恢复上次的配置和插件列表 | 重启不丢失 |
| 3 | 增强沙箱（白名单 API） | 安全隔离 |

---

## 12. 文件清单

### 新增文件（12 个）

```
src/engine/
├── PluginEngine.ts           # 引擎核心
├── HostAPIBridge.ts          # 宿主 API 适配器（接口 + 默认实现）
├── Scanner.ts                # 插件发现
├── Registry.ts               # 注册表
├── LifecycleManager.ts       # 生命周期状态机
├── SandboxFactory.ts         # 沙箱工厂
├── DependencyGraph.ts        # 依赖图
├── EventBus.ts               # 事件总线
├── ConfigDB.ts               # 配置持久化
│
├── types/
│   ├── host-api.ts           # HostAPIBridge 接口
│   ├── sandbox.ts            # 沙箱配置类型
│   └── events.ts             # 事件定义
```

### 删除文件（3 个）

```
src/services/plugin-manager.ts       → 替换为 PluginEngine
src/stores/plugin-store.ts           → 合并到 PluginEngine 内部状态
```

### 修改文件（3 个）

```
src/App.tsx                      → 注入 HostAPIBridge，启动 PluginEngine
src/components/Settings/PluginManagerDialog.tsx → 适配新引擎 API
src/components/Editor/StatusBar.tsx         → 状态栏通过 HostAPIBridge 读取
```
