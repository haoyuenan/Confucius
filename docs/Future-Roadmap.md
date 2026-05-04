# Confucius 未来发展规划

**版本**：v1.0  
**日期**：2026-05-04  
**基于**：当前已完成 Phase 1-6 核心功能开发，122 测试通过，项目处于 Beta 阶段

---

## 目录

1. [现状评估](#1-现状评估)
2. [功能拓展路线图](#2-功能拓展路线图)
3. [技术栈演进路径](#3-技术栈演进路径)
4. [性能优化策略](#4-性能优化策略)
5. [市场应用场景](#5-市场应用场景)
6. [阶段性里程碑](#6-阶段性里程碑)
7. [风险评估](#7-风险评估)

---

## 1. 现状评估

### 1.1 已完成能力

| 领域 | 能力 | 成熟度 |
|------|------|--------|
| 编辑核心 | CM6 Markdown 编辑、语法高亮、格式化工具栏、快捷键 | ✅ 稳定 |
| 渲染管线 | markdown-it + highlight.js + KaTeX + Mermaid + DOMPurify | ✅ 稳定 |
| 视图模式 | 双栏/WYSIWYG/纯预览三种模式、专注/打字机模式 | ✅ 稳定 |
| 文件管理 | 多标签页、文件树浏览、全局搜索、编码自动检测 | ✅ 稳定 |
| 导出 | HTML 独立文件、PDF A4 打印 | ✅ 稳定 |
| 主题 | 亮色/暗色/护眼三主题，持久化，hljs+Mermaid 联动 | ✅ 稳定 |
| 测试 | 122 单元+集成测试，Store 层 100% 通过 | ✅ 稳定 |
| 安全 | DOMPurify XSS 过滤、路径遍历防护、Mermaid strict 模式 | ✅ 稳定 |

### 1.2 当前局限

| 局限 | 影响 | 当前状态 |
|------|------|---------|
| 无云同步/远程连接 | 文件仅限本地 | 架构限制 |
| 无实时协作 | 单人编辑 | 功能缺失 |
| 无插件系统 | 无法扩展 | 架构缺失 |
| 无图片管理 | 仅支持 Markdown 图片链接 | 功能缺失 |
| 无版本历史 | 无法回溯 | 功能缺失 |
| 无跨平台窗口管理 | 单窗口 | 功能限制 |
| 无 E2E 测试 | 回归风险 | 测试缺失 |
| 无 CI/CD | 发布流程人工 | 工程缺失 |

---

## 2. 功能拓展路线图

### 2.1 Phase 7 — 图片与资产管理（预估 2-3 周）

#### 2.1.1 图片粘贴与拖入

```
用户截图 → Ctrl+V / 拖入编辑器
  → 检测 clipboardData / DataTransfer
  → 编码为 Base64 或保存为本地文件
  → 自动插入 ![](assets/filename-{timestamp}.png)
```

**实现方式**：

- **粘贴处理**：CM6 `handlePaste` 事件 → 检测 `clipboardData.files` 中的图片类型
- **拖入处理**：CM6 `handleDrop` 事件 → 检测 `dataTransfer.files`
- **存储策略**（两种模式，用户可选）：
  - `assets/` 目录模式：图片保存到当前 `.md` 文件旁边的 `assets/` 目录
  - Base64 内联模式：直接嵌入文档（便携但文件大）

**新增文件**：
- `src/editor/image-paste.ts` — 图片粘贴/拖入处理
- `electron/services/image-service.ts` — 图片文件写入 + 压缩（sharp/pngquant）

**依赖**：`sharp`（可选图片压缩）

#### 2.1.2 图片管理器

- 侧边栏新增"图片"Tab
- 展示当前文档引用的所有图片（解析 Markdown 图片语法）
- 支持：
  - 缩略图预览
  - 点击跳转到图片位置
  - 右键"在资源管理器中显示"
  - 图片删除（同时更新 Markdown 源文）
  - 批量导出图片

**新增文件**：
- `src/components/Sidebar/ImagePanel.tsx` — 图片管理面板

#### 2.1.3 验收标准

- [ ] 截图后 Ctrl+V 粘贴 → 自动插入图片链接
- [ ] 拖入图片文件 → 自动保存到 assets 目录
- [ ] 图片管理器正确解析并展示所有图片引用
- [ ] 图片压缩（可选）减少 50%+ 体积
- [ ] 122 测试通过

---

### 2.2 Phase 8 — 插件系统（预估 3-4 周）

#### 2.2.1 架构设计

```
┌─────────────────────────────────────┐
│            PluginManager             │
│  ┌─────────┐ ┌─────────┐ ┌───────┐  │
│  │ 编辑器   │ │ 渲染器   │ │ 主题   │  │
│  │ 插件     │ │ 插件    │ │ 插件   │  │
│  └─────────┘ └─────────┘ └───────┘  │
│  ┌─────────┐ ┌─────────┐ ┌───────┐  │
│  │ 工具栏   │ │ 侧边栏   │ │ 命令   │  │
│  │ 插件     │ │ 插件    │ │ 插件   │  │
│  └─────────┘ └─────────┘ └───────┘  │
└─────────────────────────────────────┘
```

#### 2.2.2 插件 API 设计

```typescript
interface ConfuciusPlugin {
  id: string
  name: string
  version: string
  description?: string

  /** 插件初始化 */
  onActivate?: (ctx: PluginContext) => void
  /** 插件卸载 */
  onDeactivate?: () => void

  /** 注册 CM6 扩展 */
  cmExtensions?: Extension[]
  /** 注册 markdown-it 插件 */
  mdPlugins?: ((md: MarkdownIt) => void)[]
  /** 注册命令（Ctrl+Shift+P 可搜索执行） */
  commands?: PluginCommand[]

  /** 注册侧边栏面板 */
  sidebarTab?: { id: string; label: string; icon: string; component: ReactNode }
  /** 注册工具栏按钮 */
  toolbarButtons?: ToolbarButtonDef[]
}

interface PluginContext {
  editorView: EditorView
  tabStore: TabStore
  addSidebarTab: (tab: SidebarTabDef) => void
  registerCommand: (cmd: CommandDef) => void
}
```

#### 2.2.3 内置插件示例

| 插件 | 功能 | 实现方式 |
|------|------|---------|
| emoji | `:smile:` → 😄 | markdown-it 插件 |
| toc | `[TOC]` → 目录树 | markdown-it 插件 |
| footnote | GFM 脚注 | markdown-it 插件 |
| latex-bridge | markdown-it-texmath 集成 | markdown-it 插件 |
| word-count | 状态栏字数统计 | 命令插件 |

#### 2.2.4 第三方插件加载

```typescript
// ~/.confucius/plugins/my-plugin/index.js
export default {
  id: 'my-plugin',
  name: '自定义插件',
  version: '1.0.0',
  onActivate: (ctx) => {
    ctx.addSidebarTab({
      id: 'my-tab', label: '我的面板', icon: '📋',
      component: MyPanel,
    })
  },
}
```

**加载器**：扫描 `~/.confucius/plugins/` 目录下的 `index.js`/`index.ts` 文件，通过 `import()` 动态加载。

**新增文件**：
- `src/services/plugin-manager.ts` — 插件注册/加载/生命周期
- `src/types/plugin.ts` — 插件类型定义

#### 2.2.5 验收标准

- [ ] 插件可注册 CM6 扩展并正常生效
- [ ] 插件可添加 markdown-it 规则（如 emoji 渲染）
- [ ] 插件可添加侧边栏面板
- [ ] 插件可注册全局命令
- [ ] 支持从 `~/.confucius/plugins/` 加载第三方插件
- [ ] 插件崩溃不影响主进程（try-catch 隔离）

---

### 2.3 Phase 9 — 云同步与多设备（预估 4-5 周）

#### 2.3.1 同步架构

```
┌──────────────┐     ┌──────────┐     ┌──────────────┐
│  Mac Confucius│────▶│          │◀────│ Win Confucius │
└──────────────┘     │  云服务   │     └──────────────┘
┌──────────────┐     │          │     ┌──────────────┐
│ Linux Confucius│───▶│          │◀────│   Web 端     │
└──────────────┘     └──────────┘     └──────────────┘
```

#### 2.3.2 同步方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **iCloud/OneDrive 文件级** | 零开发成本，系统自带 | 无冲突解决，不同平台难统一 | ⭐⭐ |
| **Git 驱动** | 免费，版本历史天然支持 | 学习成本高，实时性差 | ⭐⭐⭐ |
| **自建 WebSocket 服务** | 实时，可控 | 需要服务器，维护成本 | ⭐⭐⭐⭐ |
| **Supabase/CouchDB** | 开箱即用，实时同步 | 依赖第三方 | ⭐⭐⭐⭐⭐ |

**推荐路径**：先用 Git 驱动（最简单），后续迁移到 Supabase/CouchDB。

#### 2.3.3 Git 驱动同步（MVP）

```typescript
// electron/services/git-sync.ts
class GitSyncService {
  async init(repoPath: string): Promise<void> {
    if (!await this.isGitRepo(repoPath)) {
      await this.gitInit(repoPath)
    }
  }

  async autoCommit(filePath: string): Promise<void> {
    // 保存后自动 commit（3 秒防抖）
    await exec(`git add "${filePath}"`)
    await exec(`git commit -m "auto: update ${basename(filePath)}"`)
  }

  async sync(): Promise<void> {
    await exec('git pull --rebase')
    await exec('git push')
  }
}
```

**依赖**：`simple-git` 或 `isomorphic-git`（纯 JS，无需安装 Git）。

#### 2.3.4 云存储服务（进阶）

- 集成 Supabase（PostgreSQL + 实时订阅 + 存储桶）
- 文件存储在 Supabase Storage Bucket 中
- 元数据存储在 PostgreSQL 表中
- 实时同步通过 Supabase `realtime` 通道

#### 2.3.5 验收标准

- [ ] Git 自动 commit（保存后 3 秒）
- [ ] Git push/pull 一键同步（菜单项）
- [ ] 冲突检测与简单提示
- [ ] 同步状态指示器（菜单栏/状态栏）
- [ ] Supabase 集成可选（切换配置）

---

### 2.4 Phase 10 — 编辑体验进阶（预估 2-3 周）

#### 2.4.1 可拖拽重组文档结构

```
在文件中
  # 一级标题 A           ← 可拖拽
    ## 二级标题 A1        ← 可拖拽（跟随父标题）
  # 一级标题 B           
    ## 二级标题 B1

拖拽到新位置后，自动调整标题顺序和内容位置。
```

**实现**：CM6 `Decoration` + `dragOver` 事件 → 检测标题行 → 计算目标位置 → `replaceRange` 移动整个区块。

#### 2.4.2 折叠/展开标题

```
# 一级标题 A [▶]         ← 点击 ▶ 折叠
  隐藏的内容...
# 一级标题 B [▼]         ← 展开状态
  ## 二级标题 B1
```

**实现**：CM6 `foldGutter` 扩展 + 自定义 `foldService` 按标题级别折叠。

#### 2.4.3 内联代码运行器

- 在代码块右上角显示 ▶ 运行按钮
- 支持：JavaScript（`eval` 沙箱）、Python（通过本地 Python 进程）、Shell
- 运行结果在代码块下方显示

#### 2.4.4 本地字典与拼写检查

- 集成 `nspell` / `hunspell` 本地字典
- CM6 拼写检查插件（`@codemirror/lang-markdown` 已部分支持）
- 右键错误拼写 → 建议修正

#### 2.4.5 验收标准

- [ ] 标题行拖拽 → 内容区块跟随移动
- [ ] 标题折叠/展开（点击 ▶/▼）
- [ ] 代码块运行按钮（至少支持 JS）
- [ ] 拼写错误红色波浪线
- [ ] 右键拼写建议

---

### 2.5 Phase 11 — Web 版本（预估 5-6 周）

#### 2.5.1 架构方案

```
            ┌───────────────────┐
            │  Confitus Web     │
            │  (React + Vite)   │
            └────────┬──────────┘
                     │ API
            ┌────────▼──────────┐
            │   Node.js 后端    │
            │  (Fastify/Express)│
            └────────┬──────────┘
                     │ File System / Cloud
            ┌────────▼──────────┐
            │  本地文件 / 云存储  │
            └───────────────────┘
```

#### 2.5.2 分层策略

| 层 | 桌面版 | Web 版 | 共享代码 |
|----|--------|--------|---------|
| UI 组件 | ✅ 现有 | ✅ 复用 | `src/components/` |
| 编辑器 | ✅ CM6 | ✅ CM6 | `src/editor/` |
| 渲染 | ✅ markdown-it | ✅ markdown-it | `src/editor/` |
| 文件操作 | `electronAPI` IPC | REST API | Electron 层替换 |
| 存储 | 本地 fs | 服务端 fs / 云 | 抽象为 `StorageAdapter` |

#### 2.5.3 StorageAdapter 抽象

```typescript
// src/services/storage-adapter.ts
interface StorageAdapter {
  readFile(path: string): Promise<{ content: string; filePath: string }>
  writeFile(path: string, content: string): Promise<void>
  deleteFile(path: string): Promise<void>
  listDirectory(path: string): Promise<FileTreeNode>
  search(query: string, rootPath: string): Promise<SearchResult[]>
}

// Electron 实现
class ElectronStorageAdapter implements StorageAdapter {
  async readFile(path: string) {
    return window.electronAPI.readFile(path)
  }
}

// Web 实现（未来）
class WebStorageAdapter implements StorageAdapter {
  constructor(private baseUrl: string) {}
  async readFile(path: string) {
    const res = await fetch(`${this.baseUrl}/files?path=${encodeURIComponent(path)}`)
    return res.json()
  }
}
```

#### 2.5.4 验收标准

- [ ] Web 版可打开和编辑本地 Markdown 文件
- [ ] Web 版文件树正常展示
- [ ] Web 版预览渲染一致
- [ ] 桌面版和 Web 版共享 80%+ 代码
- [ ] Web 版 PWA 支持（离线缓存）

---

### 2.6 Phase 12 — 协作编辑（预估 6-8 周）

#### 2.6.1 OT/CRDT 选择

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **Yjs (CRDT)** | 成熟，去中心化，离线友好 | 学习曲线 | ⭐⭐⭐⭐⭐ |
| **ShareDB (OT)** | 基于操作，历史可追溯 | 中心化，复杂冲突 | ⭐⭐⭐ |
| **Automerge (CRDT)** | Rust 核心，高性能 | 较新，生态小 | ⭐⭐⭐⭐ |

**推荐**：**Yjs** — 社区最大，与 CM6 有现成集成（`y-codemirror.next`）。

#### 2.6.2 Yjs 集成架构

```
┌──────────────┐     WebSocket      ┌──────────────┐
│  User A      │◀────────────────▶  │  Yjs Server   │
│  CM6 + y-cm6  │                   │  (y-websocket) │
└──────────────┘                    └───────┬────────┘
                                           │
┌──────────────┐                    ┌───────▼────────┐
│  User B      │◀────────────────▶  │    Yjs Doc     │
│  CM6 + y-cm6  │                    │   (CRDT 状态)  │
└──────────────┘                    └────────────────┘
```

#### 2.6.3 功能需求

- 实时光标显示（其他用户的闪烁光标 + 用户名）
- 实时选区显示（其他用户的文本选中高亮）
- 冲突自动合并（CRDT 天然支持）
- 用户在线状态指示
- 可选的只读/可写权限控制

#### 2.6.4 验收标准

- [ ] 两个用户同时编辑同一文档 → 内容自动合并
- [ ] 用户 A 的光标在用户 B 屏幕上可见
- [ ] 网络断开 → 本地编辑 → 重连后合并
- [ ] 延迟 < 200ms (局域网) / < 1000ms (公网)

---

### 2.7 Phase 13 — 国际化与辅助功能（预估 1-2 周）

#### 2.7.1 国际化 (i18n)

```typescript
// src/i18n/zh-CN.json
{ "menu.file": "文件", "menu.edit": "编辑", "editor.bold": "加粗" }

// src/i18n/en.json
{ "menu.file": "File", "menu.edit": "Edit", "editor.bold": "Bold" }
```

- 使用 `react-i18next` 或自研轻量方案
- 支持中文（默认）、英文
- 自动检测系统语言
- 语言切换设置持久化

#### 2.7.2 辅助功能 (a11y)

| 项 | 实现方式 |
|----|---------|
| 屏幕阅读器 | 所有图标按钮加 `aria-label` |
| 键盘导航 | Tab 索引、role 属性 |
| 高对比度主题 | `prefers-contrast: more` 媒体查询 |
| 字体缩放 | 跟随系统字体大小设置 |
| 减少动画 | `prefers-reduced-motion` 媒体查询 |

#### 2.7.3 验收标准

- [ ] 切换英文 → 全部菜单和 UI 显示英文
- [ ] 屏幕阅读器能正确朗读编辑器内容
- [ ] Tab 键可遍历所有交互元素
- [ ] 高对比度主题下文字清晰可辨

---

## 3. 技术栈演进路径

### 3.1 短期（0-6 个月）

| 当前 | 目标 | 理由 |
|------|------|------|
| Vite 5 + Electron 28 | Vite 6 + Electron 33+ | 安全性更新，CJS deprecation 解决 |
| React 18 | React 19 | 新 Hooks、编译器优化 |
| Vitest 4 | Vitest 最新 | 保持更新 |
| 无 CI/CD | GitHub Actions | 自动化发布流程 |
| 无 E2E | Playwright + Electron | 回归测试保障 |

### 3.2 中期（6-12 个月）

| 方向 | 技术选型 | 价值 |
|------|---------|------|
| **插件系统** | 自研 `PluginManager` | 生态基础，社区贡献入口 |
| **云同步** | Supabase / isogit | 多设备协作基础 |
| **Web 版** | `StorageAdapter` 抽象 | 覆盖浏览器场景 |
| **状态管理** | 现有 Zustand 足够 | 无需迁移 |

### 3.3 长期（12-24 个月）

| 方向 | 技术选型 | 价值 |
|------|---------|------|
| **协作编辑** | Yjs + y-websocket | 多人实时协作 |
| **移动端** | React Native / Tauri Mobile | 移动写作场景 |
| **AI 辅助** | OpenAI API / 本地 LLM | 智能写作助手 |
| **桌面分发** | Electron → Tauri(可选) | 更小的安装包体积 |

---

## 4. 性能优化策略

### 4.1 渲染性能

#### 4.1.1 当前瓶颈

| 场景 | 耗时 | 原因 |
|------|------|------|
| 首次打开 500KB 文档 | ~800ms | 全量 markdown-it + Mermaid 初始化 |
| 编辑时预览更新 | ~50-200ms | 全量 re-render + KaTeX 扫描 |
| Mermaid 图表渲染 | 每个图表 ~100-500ms | 顺序渲染，大图表慢 |

#### 4.1.2 优化方案

```
优先级 P0 — 当前即可实施
├── 预览增量渲染（morphdom）✅ 已实现
├── WYSIWYG 视口扫描 ✅ 已实现
├── 搜索并行化 (Promise.all) ⏳ 未实现

优先级 P1 — 中期优化
├── Worker 线程渲染
│   └── markdown-it → Web Worker
│   └── KaTeX → Web Worker 预编译
│   └── 主线程不阻塞
├── Mermaid 懒加载
│   └── 仅渲染视口内的图表
│   └── 滚动进入视口时触发渲染
├── 文档分块渲染
│   └── 超大文档 (>1MB) 分块渲染预览
│   └── 每次只渲染可见区域前后 2000px

优先级 P2 — 长期优化
├── 虚拟列表（编辑器 + 预览）
│   └── CM6 已有虚拟行支持（需配置）
│   └── 预览区虚拟列表（react-virtualized）
├── 代码高亮懒加载
│   └── 仅加载当前文档使用到的语言
└── 公式缓存
    └── 相同公式内容只渲染一次
```

### 4.2 启动性能

#### 4.2.1 当前启动时序

```
用户双击 → Electron 初始化 (~800ms)
         → Vite 开发服务（热启动 ~2s，二次 ~300ms）
         → React 挂载 (~200ms)
         → CM6 初始化 (~150ms)
         → hljs CDN 加载 (~300ms-2s 取决于网络)
         → Mermaid 初始化 (~400ms)
         → 总计：~2-4s
```

#### 4.2.2 优化方案

| 措施 | 加速 | 实现 |
|------|------|------|
| hljs 主题本地嵌入 | ~2s | 移除 CDN 加载，直接打包 CSS |
| Mermaid 懒加载 | ~400ms | 页面中首次遇到 ` ```mermaid ` 时才初始化 |
| Electron 懒加载窗口 | ~300ms | 先显示空白窗口，再异步加载渲染进程 |
| Vite 预构建优化 | ~200ms | 配置 `optimizeDeps.include` |

### 4.3 内存优化

| 场景 | 当前 | 目标 | 方案 |
|------|------|------|------|
| 打开 30+ 标签页 | ~200MB | < 100MB | 非活跃标签的 `content` 惰性加载 |
| 大文档 (5MB) | ~300MB | < 150MB | CM6 扩展配置 `maxLength` + 分片加载 |
| 长时间运行 (8h+) | 可能有泄漏 | 稳定 < 150MB | 定期 GC 触发器 + 标签页回收 |

---

## 5. 市场应用场景

### 5.1 目标用户群

| 用户群 | 规模估计 | 核心需求 | 付费意愿 |
|--------|---------|---------|---------|
| **程序员/技术写作者** | 大 | Markdown 编辑、代码块、GFM | ⭐⭐⭐ |
| **学术研究者** | 中 | 数学公式、引用管理、LaTeX | ⭐⭐⭐⭐ |
| **笔记用户** | 大 | 多标签、全文搜索、云同步 | ⭐⭐ |
| **项目管理** | 中 | 文档协作、版本历史、TOC | ⭐⭐⭐ |
| **自由作家** | 小 | 专注模式、字数统计、导出多样式 | ⭐⭐⭐⭐ |
| **学生** | 大 | 免费、笔记同步、公式 | ⭐ |

### 5.2 差异化竞争分析

| 竞品 | 优势 | 劣势 | Confucius 切入点 |
|------|------|------|-----------------|
| **Typora** | 极致简约，所见即所得 | 闭源，更新慢 | 开源 + 多平台打包 |
| **Obsidian** | 插件生态丰富，双链笔记 | 不是纯 Markdown，有锁定效应 | 纯 Markdown，轻量无锁定 |
| **VS Code** | 万能编辑器，海量扩展 | 启动慢，Markdown 编辑非核心 | 专注 Markdown，启动快 |
| **Notion** | 协作强，数据库功能 | 网络依赖，输出不标准 | 本地优先，标准 Markdown |
| **MarkText** | 开源，WYSIWYG | 维护缓慢 | 更活跃的社区开发 |

### 5.3 商业模式建议

| 模式 | 定价 | 适合阶段 |
|------|------|---------|
| **开源免费** | ¥0 | 早期（当前）— 积累用户和社区 |
| **赞助/打赏** | 自愿 | 中期 — GitHub Sponsors / 爱发电 |
| **云同步订阅** | ¥9.9/月 | 中期 — Supabase 服务成本 |
| **协作版 (团队)** | ¥39/月/5人 | 中后期 — 协作服务 |
| **企业版** | 按需定价 | 后期 — 私有部署 + 定制功能 |
| **应用商店出售** | ¥30-50 一次性 | 成熟期 — macOS App Store / Windows Store |

### 5.4 市场推广渠道

| 渠道 | 策略 | 预期效果 |
|------|------|---------|
| GitHub | 开源发布，README 展示，收集 Star | 开发者认知 |
| Product Hunt | 产品发布帖 | 国际曝光 |
| 少数派/V2EX | 中文社区分享使用教程 | 国内用户引流 |
| 知乎/掘金 | 技术对比文（vs Typora / Obsidian） | 精准获客 |
| 视频教程 | B站/YouTube 上手教程 | 低门槛引流 |
| 插件市场 | 发布 Obsidian/VS Code 对比插件 | 竞品用户转化 |

---

## 6. 阶段性里程碑

### 6.1 6 个月路线图

```
第 1-2 月 (Phase 7) ──────────────────────────────
  📦 发布 v2.0 — 图片管理
  ├── 图片粘贴/拖入支持
  ├── 图片管理器（缩略图预览）
  ├── E2E 测试 (Playwright)
  ├── CI/CD (GitHub Actions)
  └── GitHub 开源发布

第 3-4 月 (Phase 8+9) ───────────────────────────
  📦 发布 v3.0 — 插件系统 + Git 同步
  ├── PluginManager API 稳定
  ├── 内置插件 (emoji/toc/footnote)
  ├── Git 自动 commit + push/pull
  └── 第三方插件加载

第 5-6 月 (Phase 10+11) ─────────────────────────
  📦 发布 v4.0 — Web 版 + 高级编辑
  ├── Web 版 MVP (React + API)
  ├── StorageAdapter 抽象
  ├── 标题折叠/拖拽
  ├── 拼写检查
  └── 代码块运行
```

### 6.2 关键指标 (KPI)

| 指标 | 3 个月 | 6 个月 | 12 个月 |
|------|--------|--------|---------|
| GitHub Stars | 100 | 500 | 2000+ |
| 测试覆盖率 | 70% (当前) | 80% | 90% |
| E2E 测试数 | 0 → 14+ | 30+ | 50+ |
| 插件生态 | 0 | 5 内置 | 20+ 第三方 |
| 月活用户 | — | 100 | 1000+ |
| 代码行数 | ~12,000 | ~18,000 | ~25,000 |

---

## 7. 风险评估

### 7.1 技术风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| Electron 升级破坏兼容性 | 中 | 高 | 锁定 Electron 28 LTS，仅在主要版本前升级 |
| CM6 版本不兼容 | 低 | 高 | 紧跟上流，测试先行 |
| Yjs 集成复杂度 | 高 | 中 | 先做小范围 POC，分步集成 |
| 插件系统安全漏洞 | 中 | 高 | 插件运行在 iframe 沙箱中 |

### 7.2 产品风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 用户期望过高 | 高 | 中 | 明确 roadmap，分步交付 |
| 与 Obsidian/Typora 差异不足 | 中 | 高 | 坚持纯 Markdown + 开源 + 本地优先 |
| 社区活跃度不足 | 中 | 中 | 主动运营，Quick Start 文档 |
| 商业模式不清晰 | 中 | 中 | 渐进式收费，核心功能永久免费 |

### 7.3 工程风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| Web 版维护成本陡增 | 高 | 中 | 控制共享代码比例 ≥ 80% |
| 云同步服务成本 | 中 | 低 | Supabase 免费额度足够早期使用 |
| 协作版开发周期过长 | 中 | 高 | MVP 仅支持双人协作，逐步扩展 |

---

## 附录 A：技术债务清理清单

| 项 | 优先级 | 预计工时 | 说明 |
|----|--------|---------|------|
| 创建 `services/` 层封装 IPC 调用 | P1 | 4h | 组件不再直接调用 `window.electronAPI` |
| CSS Modules 迁移 | P2 | 8h | 逐步迁移全局 CSS，降低命名冲突 |
| FileService 类封装 | P1 | 3h | `readFile/writeFile/rename/delete` 统一 |
| markdown-it-texmath 集成 | P2 | 2h | 替换自研 KaTeX DOM 遍历 |
| hljs 主题本地打包 | P1 | 2h | 移除 CDN 依赖 |
| 搜索并行化 | P2 | 1h | `Promise.all` 并发读取文件 |
| E2E 测试 | P0 | 16h | Playwright + Electron 4 个 spec |
| 搜索框 focus 样式 | P1 | 0.5h | 修复 `opacity` 错误 |

---

## 附录 B：长期愿景

> **Confucius** 致力于成为最优秀的开源 Markdown 编辑器——
>
> - **对用户**：一个干净、专注、标准化的写作环境，不锁定格式、不绑架数据
> - **对开发者**：一个开放、可扩展、文档完善的插件平台
> - **对社区**：一个活跃、友好的开源项目，欢迎所有贡献者

### 核心理念

```
✅ 纯 Markdown — 输出即标准 .md 文件，零专有格式
✅ 本地优先 — 离线可用，文件掌握在用户自己手中
✅ 开源透明 — MIT 协议，代码可审计、可 fork
✅ 跨平台 — Windows / macOS / Linux / Web
✅ 可扩展 — 插件系统 + 丰富的 API
✅ 性能 — 启动 < 1s，编辑 60fps
```
