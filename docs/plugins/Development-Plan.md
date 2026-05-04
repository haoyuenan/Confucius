# 插件系统开发实施计划

**版本**：v1.0  
**日期**：2026-05-04  
**前置**：Phase 1-6 核心功能已稳定，122 测试通过

---

## 目录

1. [总体策略](#1-总体策略)
2. [Phase 1：解耦引擎与宿主（3h）](#phase-1解耦引擎与宿主3h)
3. [Phase 2：目录化与自动发现（2h）](#phase-2目录化与自动发现2h)
4. [Phase 3：依赖管理与事件总线（3h）](#phase-3依赖管理与事件总线3h)
5. [Phase 4：配置持久化与沙箱增强（3h）](#phase-4配置持久化与沙箱增强3h)
6. [Phase 5：插件市场与目录扫描 UI（4h）](#phase-5插件市场与目录扫描-ui4h)
7. [Phase 6：测试与文档（3h）](#phase-6测试与文档3h)
8. [时间线与里程碑](#8-时间线与里程碑)
9. [文件变更总览](#9-文件变更总览)

---

## 1. 总体策略

### 开发顺序

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5 ──→ Phase 6
 解耦         发现         依赖/事件     持久化        UI         测试
  (3h)        (2h)         (3h)        (3h)        (4h)        (3h)
```

每个 Phase 可独立发布，不阻塞下游。Phase 1-2 完成后旧插件格式可正常使用。

### 验收标准（跨 Phase）

| # | 验收项 | 验证方式 |
|---|--------|---------|
| 1 | `PluginEngine` 不 import 任何 `src/stores/`、`src/editor/`、`src/components/` 代码 | `grep -r "from.*stores\|editor\|components" src/engine/` 无结果 |
| 2 | 自动扫描 `plugins/builtins/` 目录即可加载内置插件，无需手动 import | 删除 `App.tsx` 中的 `registerBuiltins` 调用后重启，状态栏仍显示 |
| 3 | 插件 A 依赖插件 B，先加载 A 时自动按序加载 B | 手动测试 |
| 4 | 重启后插件状态恢复（上次启用的插件自动加载） | 关闭重开应用 |
| 5 | 插件崩溃不阻塞其他插件 | 加载一个有语法错误的插件后 UI 正常 |
| 6 | 122 测试通过 | `vitest run` |

---

## 2. Phase 1：解耦引擎与宿主（3h）

### 目标

将 `PluginManager` 改造成 `PluginEngine`，不引用任何宿主内部模块，通过 `HostAPIBridge` 接口通信。

### 任务分解

| 任务 | 工时 | 文件 | 说明 |
|------|------|------|------|
| 1.1 定义 `HostAPIBridge` 接口 | 0.5h | `src/engine/types/host-api.ts` | 编辑内容、光标、UI 扩展、事件、生命周期共 5 组方法 |
| 1.2 创建 `HostAPIBridgeImpl` 适配器 | 0.5h | `src/engine/HostAPIBridge.ts` | 从当前 `createContext` 逻辑中抽取，实现 `HostAPIBridge` |
| 1.3 创建 `PluginEngine` 类 | 1h | `src/engine/PluginEngine.ts` | 注册、激活、卸载、资源追踪，接收 `HostAPIBridge` 构造参数 |
| 1.4 创建 `Registry` 模块 | 0.5h | `src/engine/Registry.ts` | 插件注册表，增删查、按标签查询 |
| 1.5 集成到 `App.tsx` | 0.5h | `src/App.tsx` | 创建适配器 → 注入引擎 → `start()`，删除 `registerBuiltins` |
| 1.6 删除旧模块 | 0h | `plugin-manager.ts`, `plugin-store.ts` | 代码已被替换 |

### 关键接口

```typescript
// src/engine/types/host-api.ts
export interface HostAPIBridge {
  getEditorContent(): string
  getCursorPosition(): { line: number; col: number }
  getActiveTabFilePath(): string | null
  addStatusBarItem(item: StatusBarItemDef): () => void
  addSidebarTab(tab: SidebarTabDef): () => void
  onContentChange(cb: (content: string) => void): () => void
  getAppVersion(): string
  getAPIVersion(): string
}
```

### 验收

- [ ] `grep "from.*stores\|from.*editor\|from.*components" src/engine/*.ts` 返回空
- [ ] 内置状态栏插件正常运行
- [ ] 外部 doc-stats 插件可加载
- [ ] 122 测试通过

---

## 3. Phase 2：目录化与自动发现（2h）

### 目标

内置插件从 `src/plugins/builtins/` 移入 `plugins/builtins/` 目录，引擎自动扫描加载，无需手工 `register`。

### 任务分解

| 任务 | 工时 | 文件 | 说明 |
|------|------|------|------|
| 2.1 创建 `Scanner` 模块 | 1h | `src/engine/Scanner.ts` | 递归扫描目录、读取 JS 文件、通过 `SandboxFactory` 执行 |
| 2.2 创建 `SandboxFactory` 模块 | 0.5h | `src/engine/SandboxFactory.ts` | 从 `loadExternalPlugin` 抽取 |
| 2.3 迁移内置插件 | 0.5h | 移动文件 | `src/plugins/builtins/` → `plugins/builtins/` |
| 2.4 更新 `PluginEngine.start()` | 0.5h | `PluginEngine.ts` | 初始化时调用 `Scanner.scan(pluginDir)` |

### 目录结构

```
plugins/builtins/                  ← 内置插件（Vite 打包时复制到 dist）
├── status-bar/
│   ├── manifest.json
│   └── index.js                  ← 编译产物（.ts → .js）

~/.confucius/plugins/              ← 用户插件（运行时发现）
├── my-plugin/
│   ├── manifest.json
│   └── index.js
```

### 验收

- [ ] 删除 `App.tsx` 中所有 `registerBuiltins` 调用，重启后状态栏仍正常
- [ ] 外部插件通过 UI 加载后，重启仍在
- [ ] `plugins/builtins/` 目录增加新插件目录后自动发现

---

## 4. Phase 3：依赖管理与事件总线（3h）

### 目标

插件可声明依赖（`manifest.dependencies`），引擎按序加载；插件之间通过事件总线通信。

### 任务分解

| 任务 | 工时 | 文件 | 说明 |
|------|------|------|------|
| 3.1 创建 `DependencyGraph` | 1h | `src/engine/DependencyGraph.ts` | 拓扑排序、循环检测、缺失依赖报告 |
| 3.2 集成到 `PluginEngine.activateAll()` | 0.5h | `PluginEngine.ts` | 激活前调用 `resolveOrder()` |
| 3.3 创建 `EventBus` | 1h | `src/engine/EventBus.ts` | 发布/订阅、插件卸载自动清除 |
| 3.4 定义内置事件类型 | 0.5h | `src/engine/types/events.ts` | `file:opened`, `editor:cursor-move`, `theme:switched` 等 |
| 3.5 在 `PluginContext` 暴露 `events` | 0.5h | `HostAPIBridge.ts` | `ctx.events.on()` / `ctx.events.emit()` |

### 数据流

```
插件 A 激活 → 注册依赖 [B, C]
  → DependencyGraph.resolveOrder([A, B, C])
  → [C, B, A] 按序激活

插件 B 发布事件 'file:saved'
  → EventBus 通知所有订阅者（A 收到）
```

### 验收

- [ ] 场景 A：插件 A `dependencies: ['B']`，先加载 A → 自动激活 B 再激活 A
- [ ] 场景 B：循环依赖 `A→B→A` → 拒绝加载 + 报错信息
- [ ] 插件 A 监听 `file:saved` → 手动保存文件 → 回调触发
- [ ] 卸载插件 A → 其事件监听自动移除

---

## 5. Phase 4：配置持久化与沙箱增强（3h）

### 目标

插件设置和加载状态跨会话保持；沙箱加固，限制插件对敏感全局 API 的访问。

### 任务分解

| 任务 | 工时 | 文件 | 说明 |
|------|------|------|------|
| 4.1 创建 `ConfigDB` | 1h | `src/engine/ConfigDB.ts` | `localStorage` 持久化，JSON Schema 默认值合并 |
| 4.2 启动恢复逻辑 | 0.5h | `PluginEngine.ts` | `start()` 时读取上次启用的插件列表，按序加载 |
| 4.3 `PluginManagerDialog` 适配配置 | 0.5h | `PluginManagerDialog.tsx` | 启用/禁用开关，配置编辑器 |
| 4.4 增强 `SandboxFactory` | 1h | `SandboxFactory.ts` | Proxy 拦截 `window/document/fetch/localStorage` |

### ConfigDB 数据结构

```json
// localStorage['confucius:plugin-config']
{
  "my-plugin": {
    "enabled": true,
    "settings": { "autoComplete": true },
    "permissions": ["editor:modify", "ui:statusbar"]
  },
  "doc-stats": {
    "enabled": false,
    "settings": {}
  }
}
```

### 验收

- [ ] 加载 doc-stats 插件 → 关闭应用 → 重启 → 自动加载
- [ ] 禁用 doc-stats 插件 → 重启 → 不加载
- [ ] 沙箱中 `window` 为 `undefined`，`fetch` 为 `undefined`
- [ ] 沙箱中 `console`、`Math`、`JSON` 正常可用

---

## 6. Phase 5：插件市场与目录扫描 UI（4h）

### 目标

用户可打开插件目录、从文件夹批量管理插件；预置插件示例库。

### 任务分解

| 任务 | 工时 | 文件 | 说明 |
|------|------|------|------|
| 5.1 插件目录扫描按钮 | 1h | `PluginManagerDialog.tsx` | "打开插件目录"按钮 → 在文件管理器中显示目录 |
| 5.2 批量扫描加载 | 1h | `Scanner.ts` + 对话框 | 扫描整个目录，列表展示未加载的插件 |
| 5.3 插件详情面板 | 1h | `PluginManagerDialog.tsx` | 点击插件显示详情（权限、配置、描述） |
| 5.4 整理示例插件 | 0.5h | `plugins/examples/` | doc-stats、status-bar-plus 移到 examples |
| 5.5 更新 README | 0.5h | `docs/plugins/README.md` | 插件开发指南 |

### UI 改造

```
┌─────────────────────────────────────────┐
│  插件管理                            ✕  │
├─────────────────────────────────────────┤
│  已加载 (3)    可用 (5)    已禁用 (1)    │ ← 标签页
├─────────────────────────────────────────┤
│  ┌─ 状态栏信息 ───────────────────────┐ │
│  │  v1.1.0  显示字数、光标位置...     │ │
│  │  builtin:status-bar   [禁用] [详情] │ │
│  ├─ 文档统计 ─────────────────────────┤ │
│  │  v1.0.0  状态栏显示字数/阅读时间    │ │
│  │  doc-stats              [禁用] [详情] │ │
│  └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│  [打开插件目录]        [加载插件...]    │
└─────────────────────────────────────────┘
```

### 验收

- [ ] "打开插件目录" → 资源管理器打开 `~/.confucius/plugins/`
- [ ] 可用标签页显示目录中已存在但未加载的插件
- [ ] 点击详情展开版本、权限、描述、配置项

---

## 7. Phase 6：测试与文档（3h）

### 目标

核心单元测试覆盖、插件开发文档完善。

### 任务分解

| 任务 | 工时 | 测试对象 | 用例数 |
|------|------|---------|--------|
| 6.1 `DependencyGraph` 测试 | 0.5h | 拓扑排序、循环检测、缺失报告 | 6 |
| 6.2 `EventBus` 测试 | 0.5h | 订阅/发布/自动清理/隔离 | 5 |
| 6.3 `HostAPIBridgeImpl` 测试 | 0.5h | 所有桥接方法 | 5 |
| 6.4 `Scanner` 测试 | 0.5h | 目录扫描、manifest 解析 | 3 |
| 6.5 `ConfigDB` 测试 | 0.5h | 读写/合并/持久化 | 4 |
| 6.6 插件开发文档 | 0.5h | `docs/plugins/README.md` | — |

### 验收

- [ ] 23 个新测试全部通过
- [ ] 总体测试数达到 145+
- [ ] 插件开发文档涵盖：目录结构、manifest 字段、API 参考、示例

---

## 8. 时间线与里程碑

```
Day 1  ─── Phase 1：解耦引擎与宿主 ────────────────── 3h
  ├── 完成 HostAPIBridge 接口 + 实现
  ├── PluginEngine 启动
  └── 旧 PluginManager 删除
  → ✅ 里程碑：引擎与宿主解耦

Day 2  ─── Phase 2：目录化与自动发现 ──────────────── 2h
  ├── Scanner + SandboxFactory 完成
  ├── 内置插件移入 plugins/builtins/
  └── 无需手动 register
  → ✅ 里程碑：零配置插件加载

Day 3  ─── Phase 3：依赖管理与事件总线 ────────────── 3h
  ├── DependencyGraph + EventBus 完成
  ├── 插件可按依赖顺序加载
  └── 插件间可通信
  → ✅ 里程碑：插件生态基础完备

Day 4  ─── Phase 4：配置持久化与沙箱 ──────────────── 3h
  ├── ConfigDB + SandboxFactory 增强
  ├── 重启恢复
  └── 沙箱安全加固
  → ✅ 里程碑：生产可用

Day 5  ─── Phase 5：插件 UI 完善 ──────────────────── 4h
  ├── 目录扫描 UI
  ├── 插件详情面板
  └── 示例插件整理
  → ✅ 里程碑：用户体验完整

Day 6  ─── Phase 6：测试与文档 ───────────────────── 3h
  ├── 23 个新测试
  ├── 开发文档
  └── 验收检查
  → ✅ 里程碑：v3.0 发布
```

---

## 9. 文件变更总览

### 新增文件（17 个）

```
src/engine/                              ← 引擎核心模块（8 个）
├── PluginEngine.ts
├── HostAPIBridge.ts
├── Scanner.ts
├── Registry.ts
├── DependencyGraph.ts
├── EventBus.ts
├── ConfigDB.ts
├── SandboxFactory.ts

src/engine/types/                        ← 类型定义（3 个）
├── host-api.ts
├── sandbox.ts
└── events.ts

docs/plugins/                            ← 文档（3 个）
├── Development-Plan.md                  ← 本文
├── Plugin-System.md                     ← 已迁移
├── Plugin-Engine-v3-Roadmap.md          ← 已迁移
└── README.md                            ← Phase 6 编写

plugins/examples/                        ← 示例插件
├── doc-stats/index.js
└── status-bar-plus/index.js
```

### 修改文件（8 个）

```
src/App.tsx                              → 集成 PluginEngine
src/components/Settings/PluginManagerDialog.tsx → 适配新引擎 API
src/components/Editor/StatusBar.tsx      → 通过 HostAPIBridge 读取
src/main.tsx                             → 可能移除旧导入
src/styles/dialog.css                    → 微调
electron/menu.ts                         → 可能移除旧菜单项
electron/ipc-handlers.ts                 → 移除 dialog:open-plugin（由目录扫描替代）
package.json                             → 可能新增 scripts
```

### 删除文件（3 个）

```
src/services/plugin-manager.ts
src/stores/plugin-store.ts
src/plugins/builtins/status-bar-info.tsx  → 移入 plugins/builtins/ 并编译为 .js
```
