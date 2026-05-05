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
│                  宿主应用                       │
│  ┌───────────────────────────────────────────┐  │
│  │  HostAPIBridge 接口                       │  │
│  │  getEditorContent() / addStatusBarItem()  │  │
│  │  addSidebarTab() / onContentChange()      │  │
│  └──────────────────┬────────────────────────┘  │
│                     │                           │
│  ┌──────────────────▼────────────────────────┐  │
│  │  PluginEngine                             │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐  │  │
│  │  │ Scanner  │ │ Registry │ │ EventBus  │  │  │
│  │  │ 发现插件 │ │ 注册表   │ │ 插件间通信│  │  │
│  │  └──────────┘ └──────────┘ └───────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────┐  │  │
│  │  │ DepGraph │ │ ConfigDB │ │ Sandbox   │  │  │
│  │  │ 依赖解析 │ │配置持久化│ │ 沙箱执行  │  │  │
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
| `HostAPIBridge` 接口 + 实现 | ✅ 已实现 | `src/engine/types/host-api.ts` + `src/engine/HostAPIBridge.ts` |
| `PluginEngine`（完整版） | ✅ 已实现并集成 | `src/engine/PluginEngine.ts` |
| `Scanner` 目录扫描 | ✅ 已实现 | `electron/services/scanner-service.ts` + `src/engine/ScannerIPC.ts` |
| `DependencyGraph` 依赖管理 | ✅ 已实现 | `src/engine/DependencyGraph.ts` |
| `EventBus` 事件总线 | ✅ 已实现 | `src/engine/EventBus.ts` |
| `ConfigDB` 配置持久化 | ✅ 已实现 | `src/engine/ConfigDB.ts` |
| `SandboxFactory` 沙箱执行 | ✅ 已实现 | `src/engine/SandboxFactory.ts` |
| `PluginStore` | ✅ 已实现 | `src/stores/plugin-store.ts` |
| 内置插件目录化 | ✅ 已实现 | `plugins/builtins/status-bar/manifest.json` |
| 插件管理 UI | ✅ 已实现 | `src/components/Settings/PluginManagerDialog.tsx` |
| 外部插件加载 | ✅ 已实现 | 通过 UI 选择 .js 文件加载 |
| 旧 `PluginManager`（简化版） | ❌ 已删除，由 PluginEngine 替代 | `src/services/plugin-manager.ts` 已移除 |

> **说明**：`src/engine/` 下的全部 6 个核心模块（PluginEngine、HostAPIBridge、DependencyGraph、EventBus、ConfigDB、SandboxFactory）均已实现并集成。应用通过 `PluginEngine.start()` 初始化，支持内置插件注册 + 外部插件热加载 + 依赖排序 + 事件通信 + 配置持久化。详见 [Plugin-Dev-Guide.md](./Plugin-Dev-Guide.md)。
