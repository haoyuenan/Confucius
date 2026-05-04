# Phase 3 详细设计：依赖管理与事件总线

**对应**：`docs/plugins/Development-Plan.md` Phase 3
**工时**：3h
**前置**：Phase 2 完成

---

## 1. 设计目标

- `DependencyGraph`：拓扑排序加载插件，检测循环依赖
- `EventBus`：插件间发布/订阅通信，卸载自动清理
- 集成到 `PluginEngine.activateAll()`
- 在 `PluginContext` 中暴露 `events`

---

## 2. DependencyGraph

### 2.1 核心算法

```typescript
// src/engine/DependencyGraph.ts

export class DependencyGraph {
  // 邻接表：A → [B, C] 表示 A 依赖 B 和 C
  private edges: Map<string, Set<string>> = new Map()

  /** 注册插件的依赖关系 */
  add(id: string, dependencies: string[]): void {
    this.edges.set(id, new Set(dependencies))
  }

  /** 移除插件 */
  remove(id: string): void {
    this.edges.delete(id)
    // 也移除其他插件对它的依赖引用
    for (const [, deps] of this.edges) {
      deps.delete(id)
    }
  }

  /**
   * 拓扑排序（Kahn 算法）
   * @param ids 待排序的插件 ID 列表
   * @returns 按依赖顺序排列的 ID 列表
   * @throws 检测到循环依赖时抛出，附带循环路径
   */
  resolveOrder(ids: string[]): string[] {
    const inDegree = new Map<string, number>()
    const adjacency = new Map<string, string[]>()

    // 初始化所有节点
    for (const id of ids) {
      inDegree.set(id, 0)
      adjacency.set(id, [])
    }

    // 构建入度表
    for (const id of ids) {
      const deps = this.edges.get(id) || new Set()
      for (const dep of deps) {
        if (!ids.includes(dep)) continue  // 只关心给定集合内的依赖
        adjacency.get(dep)!.push(id)
        inDegree.set(id, (inDegree.get(id) || 0) + 1)
      }
    }

    // Kahn 算法
    const queue: string[] = []
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id)
    }

    const result: string[] = []
    while (queue.length > 0) {
      const id = queue.shift()!
      result.push(id)
      for (const dependent of adjacency.get(id) || []) {
        const newDegree = (inDegree.get(dependent) || 0) - 1
        inDegree.set(dependent, newDegree)
        if (newDegree === 0) queue.push(dependent)
      }
    }

    if (result.length !== ids.length) {
      // 存在循环依赖
      const cyclic = ids.filter(id => (inDegree.get(id) || 0) > 0)
      throw new CyclicDependencyError(cyclic)
    }

    return result
  }

  /** 检查指定插件的依赖是否全部已注册 */
  getMissing(pluginId: string, registeredIds: Set<string>): string[] {
    const deps = this.edges.get(pluginId)
    if (!deps) return []
    return Array.from(deps).filter(id => !registeredIds.has(id))
  }
}

export class CyclicDependencyError extends Error {
  constructor(public cyclicIds: string[]) {
    super(`循环依赖: ${cyclicIds.join(' → ')}`)
    this.name = 'CyclicDependencyError'
  }
}
```

### 2.2 复杂度

| 操作 | 复杂度 | 说明 |
|------|--------|------|
| `add()` | O(1) | 哈希表插入 |
| `resolveOrder(n)` | O(V + E) | Kahn 算法，V=插件数，E=依赖关系数 |
| `getMissing()` | O(d) | d=依赖数 |

### 2.3 使用场景

```
场景 A：正常加载
  插件 A（依赖 B、C），插件 B（无依赖），插件 C（无依赖）
  → resolveOrder([A, B, C]) → [B, C, A]

场景 B：循环依赖
  插件 A（依赖 B），插件 B（依赖 A）
  → resolveOrder([A, B]) → 抛出 CyclicDependencyError(["A", "B"])

场景 C：缺失依赖
  插件 A（依赖 B），但 B 未注册
  → getMissing("A", registered) → ["B"]
```

---

## 3. EventBus

### 3.1 事件类型

```typescript
// src/engine/types/events.ts

export interface EventDefinitions {
  'file:opened':          { path: string }
  'file:saved':           { path: string; content: string }
  'file:closed':          { path: string }
  'editor:content-change': { content: string }
  'editor:cursor-move':   { line: number; col: number }
  'editor:selection-change': { text: string }
  'theme:switched':       { theme: string }
  'mode:switched':        { mode: string }
  'app:ready':            {}
  'app:before-quit':      {}
  'plugin:activated':     { id: string }
  'plugin:deactivated':   { id: string }
  'plugin:error':         { pluginId: string; message: string }
}

export type EventName = keyof EventDefinitions
export type EventPayload<N extends EventName> = EventDefinitions[N]
```

### 3.2 EventBus 实现

```typescript
// src/engine/EventBus.ts

import type { EventName, EventPayload } from './types/events'

export class EventBus {
  // 事件名 → Set<{ pluginId, handler }>
  private listeners = new Map<string, Set<{
    pluginId: string
    handler: (payload: any) => void
  }>>()

  /**
   * 订阅事件
   * @returns 取消订阅的函数
   */
  on<N extends EventName>(
    pluginId: string,
    event: N,
    handler: (payload: EventPayload<N>) => void,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    const entry = { pluginId, handler: handler as (p: any) => void }
    this.listeners.get(event)!.add(entry)

    return () => {
      this.listeners.get(event)?.delete(entry)
    }
  }

  /** 发布事件 */
  emit<N extends EventName>(event: N, payload: EventPayload<N>): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return

    for (const entry of handlers) {
      try {
        entry.handler(payload)
      } catch (err) {
        console.error(`[EventBus] 插件 ${entry.pluginId} 处理事件 ${event} 时出错:`, err)
      }
    }
  }

  /** 清除插件的所有订阅（卸载时调用） */
  removeAllByPlugin(pluginId: string): void {
    for (const [, handlers] of this.listeners) {
      for (const entry of handlers) {
        if (entry.pluginId === pluginId) {
          handlers.delete(entry)
        }
      }
    }
  }

  /** 清除所有订阅 */
  clear(): void {
    this.listeners.clear()
  }
}
```

### 3.3 插件中的使用

```javascript
// 第三方插件代码
module.exports = {
  manifest: { id: 'my-logger', name: '文件日志', version: '1.0.0' },

  onActivate: function (ctx) {
    // 订阅文件保存事件
    ctx.events.on('file:saved', function (payload) {
      ctx.console.log('文件已保存:', payload.path, '大小:', payload.content.length)
    })

    // 订阅主题切换事件
    ctx.events.on('theme:switched', function (payload) {
      ctx.addStyle('body { transition: background 0.3s; }')
    })
  },

  onDeactivate: function () {
    // 所有订阅在卸载时由 EventBus.removeAllByPlugin 自动清理
  },
}
```

---

## 4. 集成到 PluginEngine

```typescript
// PluginEngine.ts 增量变更

export class PluginEngine {
  readonly events: EventBus
  private depGraph: DependencyGraph

  constructor(options: EngineOptions) {
    this.events = new EventBus()
    this.depGraph = new DependencyGraph()
    // ...
  }

  /** 注册插件（同时注册依赖关系） */
  register(plugin: Plugin): boolean {
    if (this.registry.has(plugin.manifest.id)) return false

    this.registry.set(plugin.manifest.id, plugin)
    this.depGraph.add(plugin.manifest.id, plugin.manifest.dependencies || [])
    return true
  }

  /** 按依赖顺序激活 */
  activateAll(): void {
    const allIds = Array.from(this.registry.keys())

    // 检查缺失依赖
    const missing = allIds.filter(id => {
      const m = this.depGraph.getMissing(id, this.registry)
      if (m.length > 0) {
        console.warn(`插件 ${id} 依赖缺失: ${m.join(', ')}，跳过`)
        return false
      }
      return true
    })

    try {
      const ordered = this.depGraph.resolveOrder(missing)
      for (const id of ordered) {
        this.activate(id)
      }
    } catch (err) {
      console.error('依赖解析失败:', err)
    }
  }

  /** 激活时在 PluginContext 中注入 events */
  private createContext(manifest: PluginManifest): PluginContext {
    return {
      // ... 其他 API ...

      events: {
        on: (event: string, handler: Function) =>
          this.events.on(manifest.id, event as any, handler as any),
      },

      // 插件卸载时自动清理事件订阅
      // 通过 ResourceTracker 实现
    }
  }

  /** 卸载时清理事件订阅 */
  deactivate(id: string): void {
    // ... 其他清理 ...
    this.events.removeAllByPlugin(id)
    this.depGraph.remove(id)
  }
}
```

---

## 5. PluginContext 新增 events API

```typescript
// PluginContext 新增字段

export interface PluginContext {
  // ... 已有 API ...

  /** 事件总线（插件间通信） */
  events: {
    /** 订阅事件，返回取消函数 */
    on: <N extends EventName>(
      event: N,
      handler: (payload: EventPayload<N>) => void
    ) => () => void
  }
}
```

---

## 6. 文件变更清单

### 新增

```
src/engine/DependencyGraph.ts    # 依赖图 + 拓扑排序
src/engine/EventBus.ts           # 事件总线
src/engine/types/events.ts       # 事件类型定义
```

### 修改

```
src/engine/PluginEngine.ts       # 集成 depGraph + events
src/engine/HostAPIBridge.ts     # 宿主触发事件（emit）
src/engine/types/plugin.ts      # PluginContext 增加 events 字段
```

---

## 7. 验收检查

- [ ] 无依赖 → 任意顺序激活
- [ ] 插件 A 依赖 B → `resolveOrder` 返回 B 在前
- [ ] 循环依赖 A→B→A → 抛出异常 + 日志
- [ ] 依赖缺失 B → 跳过 A 并警告
- [ ] `events.on('file:saved', handler)` → 触发 `emit` → handler 执行
- [ ] 卸载插件 → 事件监听自动移除
- [ ] 单个监听器异常不影响其他监听器
- [ ] 122 测试通过
