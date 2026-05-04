# Phase 1 详细设计：解耦引擎与宿主

**对应**：`docs/plugins/Development-Plan.md` Phase 1
**工时**：3h

---

## 1. 设计目标

将当前的 `PluginManager`（紧耦合 `useTabStore`、`usePluginStore`、`getActiveView`）拆分为：

- `PluginEngine` — 纯逻辑引擎，不 import 任何 `src/stores/`、`src/editor/`、`src/components/` 代码
- `HostAPIBridge` — 宿主实现的适配器接口，引擎通过它获取宿主能力
- `HostAPIBridgeImpl` — 具体的适配器实现（宿主侧代码）

---

## 2. 接口定义

### 2.1 HostAPIBridge（引擎侧依赖的接口）

```typescript
// src/engine/types/host-api.ts

import type { StatusBarItemDef, SidebarTabDef, CommandDef } from './plugin'

export interface HostAPIBridge {
  // ── 编辑器信息（只读）──
  getEditorContent(): string
  getCursorPosition(): { line: number; col: number }
  getActiveTabFilePath(): string | null

  // ── UI 扩展（引擎调用 → 宿主注册）──
  addStatusBarItem(item: StatusBarItemDef): () => void
  addSidebarTab(tab: SidebarTabDef): () => void
  addToolbarButton?(btn: ToolbarButtonDef): () => void  // 可选

  // ── 事件订阅（引擎监听 → 宿主触发）──
  onContentChange(cb: (content: string) => void): () => void
  onFileOpen(cb: (path: string) => void): () => void
  onFileSave(cb: (path: string, content: string) => void): () => void

  // ── 生命周期 ──
  getAppVersion(): string
  getAPIVersion(): string     // 例 "1.0.0"
}
```

### 2.2 PluginManifest（保留并增强）

```typescript
// src/engine/types/plugin.ts

export interface PluginManifest {
  id: string
  name: string
  version: string
  apiVersion?: string          // 新增：声明兼容的宿主 API 版本
  description?: string
  author?: string
  dependencies?: string[]      // 依赖的插件 ID 列表
  permissions?: string[]       // 声明所需权限
}
```

### 2.3 Plugin（清理后的主接口）

```typescript
export interface Plugin {
  manifest: PluginManifest
  onActivate?: (ctx: PluginContext) => void
  onDeactivate?: () => void
}
```

### 2.4 PluginContext（简化，不暴露内部模块）

```typescript
export interface PluginContext {
  /** 当前编辑器纯文本内容 */
  getContent(): string
  /** 光标位置 */
  getCursorPosition(): { line: number; col: number }
  /** 当前文件路径 */
  getActiveFilePath(): string | null

  /** 注册状态栏条目 */
  addStatusBarItem(item: StatusBarItemDef): () => void
  /** 注册侧边栏面板 */
  addSidebarTab(tab: SidebarTabDef): () => void
  /** 注入自定义 CSS */
  addStyle(css: string): () => void

  /** 监听内容变化 */
  onContentChange(cb: (content: string) => void): () => void

  /** 沙箱安全版控制台 */
  console: Pick<Console, 'log' | 'warn' | 'error'>
}
```

---

## 3. PluginEngine 类

```typescript
// src/engine/PluginEngine.ts

export class PluginEngine {
  private bridge: HostAPIBridge
  private registry: Map<string, Plugin> = new Map()
  private activeIds: Set<string> = new Set()

  // 资源追踪：插件 ID → 清理函数列表
  private resourceCleanups: Map<string, (() => void)[]> = new Map()

  constructor(bridge: HostAPIBridge) {
    this.bridge = bridge
  }

  /** 注册插件（不激活） */
  register(plugin: Plugin): boolean { ... }

  /** 激活单个插件 */
  activate(id: string): boolean {
    // 1. 检查已注册
    // 2. 创建 PluginContext（内部调用 bridge 方法）
    // 3. plugin.onActivate(ctx)
    // 4. 自动追踪所有 add* 返回的清理函数
    // 5. 标记 active
  }

  /** 按依赖顺序激活所有 */
  activateAll(): void { ... }

  /** 卸载 */
  deactivate(id: string): void {
    // 1. 调用插件 onDeactivate
    // 2. 自动清理所有追踪的资源
    // 3. 标记 inactive
  }

  /** 列出已注册插件 */
  getPlugins(): PluginManifest[] { ... }

  /** 引擎内部通知内容变化（由宿主调用） */
  notifyContentChange(content: string): void { ... }
}
```

### 3.1 自动资源追踪

```typescript
private trackResource(pluginId: string, disposer: () => void): void {
  if (!this.resourceCleanups.has(pluginId)) {
    this.resourceCleanups.set(pluginId, [])
  }
  this.resourceCleanups.get(pluginId)!.push(disposer)
}

private cleanupAll(pluginId: string): void {
  this.resourceCleanups.get(pluginId)?.forEach(fn => fn())
  this.resourceCleanups.delete(pluginId)
}
```

引擎在 `createContext` 时，自动包装 `addStatusBarItem`、`addSidebarTab` 等方法，使其注册行为被追踪。插件无需手动管理清理函数。

---

## 4. HostAPIBridgeImpl（宿主侧适配器）

```typescript
// src/engine/HostAPIBridge.ts

import { getActiveView } from '../editor/active-view'
import { useTabStore } from '../stores/tab-store'
import { usePluginStore } from '../stores/plugin-store'

export class HostAPIBridgeImpl implements HostAPIBridge {
  getEditorContent(): string {
    return document.querySelector('.cm-content')?.textContent ?? ''
  }

  getCursorPosition(): { line: number; col: number } {
    const view = getActiveView()
    if (!view) return { line: 1, col: 1 }
    const { main } = view.state.selection
    const line = view.state.doc.lineAt(main.head)
    return { line: line.number, col: main.head - line.from + 1 }
  }

  getActiveTabFilePath(): string | null {
    return useTabStore.getState().activeTab()?.filePath ?? null
  }

  addStatusBarItem(item: StatusBarItemDef): () => void {
    return usePluginStore.getState().addStatusBarItem(item)
  }

  addSidebarTab(tab: SidebarTabDef): () => void {
    return usePluginStore.getState().addSidebarTab(tab)
  }

  onContentChange(cb: (content: string) => void): () => void {
    // 使用 MutationObserver 监听 .cm-content 变化
    // 或订阅 editorStore
    const unsub = useEditorStore.subscribe(
      (state) => state.content,
      (content) => cb(content)
    )
    return unsub
  }

  getAppVersion(): string { return '1.0.0' }
  getAPIVersion(): string { return '1.0.0' }
}
```

---

## 5. 集成到 App.tsx

```typescript
// src/App.tsx 变更示意

import { PluginEngine } from './engine/PluginEngine'
import { HostAPIBridgeImpl } from './engine/HostAPIBridge'

function App() {
  // ... 现有代码 ...

  useEffect(() => {
    const engine = new PluginEngine(new HostAPIBridgeImpl())
    // 内置插件通过 Scanner 自动加载（Phase 2），这里不再手动 register
    // engine.register(new StatusBarPlugin())
    engine.activateAll()

    // 保存到全局以便调试
    ;(window as any).__pluginEngine = engine
  }, [])

  // ...
}
```

---

## 6. 文件变更清单

### 新增

```
src/engine/
├── PluginEngine.ts        # 引擎核心
├── HostAPIBridge.ts       # 适配器接口 + 默认实现
└── types/
    ├── host-api.ts        # HostAPIBridge 接口
    └── plugin.ts          # Plugin / PluginManifest / PluginContext
```

### 修改

```
src/App.tsx                # 引入 PluginEngine，移除旧的 registerBuiltins
```

### 删除

```
src/services/plugin-manager.ts
src/stores/plugin-store.ts  (后续确认 StatusBar 等组件适配后删除)
```

### 保留（暂不移交）

```
src/plugins/builtins/status-bar-info.tsx  # Phase 2 再迁移到 plugins/builtins/
src/components/Settings/PluginManagerDialog.tsx  # Phase 5 再改造
```

---

## 7. 验收检查

- [ ] `grep -r "from.*stores\|from.*editor\|from.*components" src/engine/*.ts` 返回空
- [ ] 启动后状态栏正常显示 4 个条目
- [ ] 加载外部 doc-stats 插件正常
- [ ] 卸载插件后状态栏条目消失
- [ ] 122 测试通过
- [ ] `tsc --noEmit` 零错误
