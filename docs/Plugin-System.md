# 插件系统架构设计

**版本**：v1.0  
**状态**：架构设计阶段（渲染进程管理器已部分实现）

---

## 1. 核心目标

| 目标 | 说明 |
|------|------|
| **解耦** | 引擎通过 `HostAPIBridge` 接口与宿主通信，不 import 任何 `src/stores/`、`src/editor/`、`src/components/` 模块 |
| **隔离** | 插件崩溃不影响宿主和其他插件（try-catch 隔离） |
| **可发现** | 自动扫描 `plugins/builtins/` 和 `~/.confucius/plugins/` 目录 |
| **类型安全** | 全部 TypeScript 接口，编译期检查 |

---

## 2. 总体架构

```
┌─────────────────────────────────────────────────┐
│                  宿主应用                         │
│  ┌───────────────────────────────────────────┐  │
│  │  HostAPIBridge 接口                       │  │
│  │  getEditorContent() / addStatusBarItem()  │  │
│  │  addSidebarTab() / onContentChange()      │  │
│  └──────────────────┬────────────────────────┘  │
│                     │                           │
│  ┌──────────────────▼────────────────────────┐  │
│  │  PluginEngine                             │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐  │  │
│  │  │ Scanner   │ │ Registry │ │ EventBus  │  │  │
│  │  │ 发现插件   │ │ 注册表    │ │ 插件间通信 │  │  │
│  │  └──────────┘ └──────────┘ └───────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐  │  │
│  │  │ DepGraph │ │ ConfigDB │ │ Sandbox   │  │  │
│  │  │ 依赖解析  │ │ 配置持久化 │ │ 沙箱执行  │  │  │
│  │  └──────────┘ └──────────┘ └───────────┘  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 3. 核心接口

### 3.1 HostAPIBridge（宿主实现的接口）

```typescript
interface HostAPIBridge {
  // 编辑器信息（只读）
  getEditorContent(): string
  getCursorPosition(): { line: number; col: number }
  getActiveTabFilePath(): string | null

  // UI 扩展
  addStatusBarItem(item: StatusBarItemDef): () => void
  addSidebarTab(tab: SidebarTabDef): () => void
  addStyle(css: string): () => void

  // 事件订阅
  onContentChange(cb: (content: string) => void): () => void

  // 元信息
  getAppVersion(): string
  getAPIVersion(): string
}
```

### 3.2 Plugin 接口

```typescript
interface PluginManifest {
  id: string
  name: string
  version: string
  apiVersion?: string          // 兼容的宿主 API 版本，如 "^1.0.0"
  dependencies?: string[]      // 依赖的插件 ID
  permissions?: string[]
}

interface Plugin {
  manifest: PluginManifest
  onActivate?: (ctx: PluginContext) => void
  onDeactivate?: () => void
}
```

### 3.3 PluginContext（插件运行时 API）

```typescript
interface PluginContext {
  getContent(): string
  getCursorPosition(): { line: number; col: number }
  getActiveFilePath(): string | null
  addStatusBarItem(item: StatusBarItemDef): () => void
  addSidebarTab(tab: SidebarTabDef): () => void
  addStyle(css: string): () => void
  onContentChange(cb: (content: string) => void): () => void
  console: Pick<Console, 'log' | 'warn' | 'error'>
  events: {
    on: (event: string, handler: Function) => () => void
  }
}
```

---

## 4. 插件发现与加载

### 4.1 目录约定

```
plugins/builtins/                    ← 内置插件（打包时复制到 dist）
├── status-bar/
│   ├── manifest.json
│   └── index.js

~/.confucius/plugins/                ← 用户插件（运行时发现）
├── my-plugin/
│   ├── manifest.json
│   └── index.js
└── disabled/                        ← 被禁用的插件移入此目录
```

### 4.2 manifest.json 格式

```json
{
  "id": "my-plugin",
  "name": "我的插件",
  "version": "1.0.0",
  "apiVersion": "^1.0.0",
  "entry": "index.js",
  "dependencies": ["other-plugin"],
  "permissions": ["ui:statusbar"]
}
```

### 4.3 加载流程

```
PluginEngine.start()
  → Scanner.scanDirectory(builtinDir) → PluginPackage[]
  → Scanner.scanDirectory(userDir)    → PluginPackage[]
  → 读取每个 pkg 的入口 JS
  → SandboxFactory.execute(code) → Plugin
  → Registry.register(plugin)
  → DependencyGraph.resolveOrder()
  → 依次 activate()
```

---

## 5. 依赖管理

```typescript
class DependencyGraph {
  add(id: string, dependencies: string[]): void
  resolveOrder(ids: string[]): string[]    // 拓扑排序，Kahn算法
  getMissing(pluginId: string, registeredIds: Set<string>): string[]
}
```

- 循环依赖 → 抛出 `CyclicDependencyError`
- 缺失依赖 → 跳过并警告

---

## 6. 事件总线

```typescript
class EventBus {
  on(pluginId: string, event: string, handler: Function): () => void
  emit(event: string, payload?: any): void
  removeAllByPlugin(pluginId: string): void
}
```

内置事件：`file:opened`、`file:saved`、`editor:content-change`、`theme:switched`、`mode:switched`、`app:ready`、`plugin:activated`、`plugin:deactivated`、`plugin:error`

---

## 7. 配置持久化

```typescript
class ConfigDB {
  get(pluginId: string): { enabled: boolean; settings: Record<string, any> }
  set(pluginId: string, entry: Partial<PluginConfigEntry>): void
  setEnabled(pluginId: string, enabled: boolean): void
  getEnabledIds(): string[]
}
```

存储在 `localStorage['confucius:plugin-config']`，重启后自动恢复。

---

## 8. 当前实现状态

| 模块 | 状态 | 文件 |
|------|------|------|
| `PluginManager`（简化版） | ✅ 已实现 | `src/services/plugin-manager.ts` |
| `PluginStore` | ✅ 已实现 | `src/stores/plugin-store.ts` |
| `HostAPIBridge` 接口 | ❌ 未实现 | — |
| `PluginEngine`（完整版） | ❌ 未实现 | — |
| `Scanner` 目录扫描 | ❌ 未实现 | — |
| `DependencyGraph` | ❌ 未实现 | — |
| `EventBus` | ❌ 未实现 | — |
| `ConfigDB` | ⚠️ 部分 | `src/engine/ConfigDB.ts` 已存在 |
| `SandboxFactory` | ⚠️ 部分 | `src/engine/SandboxFactory.ts` 已存在 |
| 内置插件目录化 | ⚠️ 部分 | `plugins/builtins/status-bar/` 已存在 |

> **说明**：`src/engine/` 下的 `PluginEngine.ts`、`DependencyGraph.ts`、`EventBus.ts`、`HostAPIBridge.ts` 等模块已作为基础设施实现，但尚未与 `PluginManager` 打通。完整的解耦和目录扫描能力为 Phase 7+ 规划内容。
