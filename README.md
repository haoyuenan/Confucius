# Confucius

> 本地 Markdown 编辑器 — Electron + React + CodeMirror 6 构建，支持插件扩展

## 功能

### 三种编辑模式
- **双栏实时预览** (split)：左侧源码编辑，右侧即时 Markdown 渲染（默认）
- **即时渲染模式** (WYSIWYG)：对标题、加粗/斜体/删除线、行内代码、无序列表、引用隐藏语法标记，光标附近恢复显示（链接、表格等语法暂不隐藏）
- **纯预览模式**：全屏阅读，居中布局（`Ctrl+Shift+O`）

### 编辑器
- **格式化工具栏**：标题、加粗/斜体/删除线、引用/代码块/列表、链接/图片/分割线/公式
- **CodeMirror 6 内核**：高性能文本编辑，Markdown 语法高亮
- **代码高亮**：支持 190+ 语言（highlight.js）
- **数学公式**：KaTeX 渲染 `$...$` 行内公式和 `$$...$$` 块级公式
- **图表支持**：Mermaid 流程图、时序图、甘特图等（`` ```` ```mermaid ```` ``）
- **GFM 兼容**：任务列表、表格等
- **专注模式** (F11)：非活动行半透明
- **打字机模式** (F12)：编辑行始终视口居中

### 文件管理
- **文件树侧边栏**：浏览和打开文件夹内的 Markdown 文件
- **大纲面板**：自动提取标题结构，点击跳转编辑器和预览区
- **全局搜索**：跨文件全文搜索，防抖 300ms，并行读取
- **文件操作**：新建、打开、保存、另存为
- **右键菜单**：新建文件/目录、重命名、删除
- **拖拽打开**：拖拽 .md/.markdown 文件到应用图标直接打开

### 视图 & 外观
- **七主题切换**：浅色（素白纸、护眼、云白、薄荷）/ 深色（暗夜黑、深海、暖灰），持久化 localStorage，工具栏一键切换浅/深模式
- **可拖拽分栏**：双栏宽度自由调节
- **滚动同步**：双栏模式下编辑区与预览区滚动百分比同步

### 导出
- **HTML 导出**：生成独立 HTML 文件
- **PDF 导出**：通过 Electron printToPDF 生成 A4 文档

### 状态栏 & 插件
- **状态栏**：底部显示编辑模式、文件编码/大小、光标位置、字数统计
- **插件系统**：支持内置和外部插件
  - Commander 模式 + 沙箱执行
  - 插件可注册状态栏条目、侧边栏面板、全局命令
  - 依赖管理（拓扑排序）、事件总线、配置持久化
  - 插件管理 UI（加载/卸载/启用/禁用）
  - TypeScript 类型定义支持
- **内置插件**（随应用自动激活）：
  - **文档模板**：一键插入预定义模板（README、API 文档、博客、周报、会议纪要），支持变量替换
  - **代码运行器**：在 Markdown 中运行 JavaScript/Python 代码块，即时查看输出
- **示例插件**（需通过插件管理 UI 手动加载，位于 `plugins/`）：
  - **文档统计**：状态栏实时显示字数、阅读时间，点击查看完整统计报告
  - **写作辅助**：智能建议和辅助功能

### 安全
- **XSS 防护**：DOMPurify 白名单过滤
- **路径校验**：拒绝 `..` 遍历和空字节注入
- **编码检测**：BOM + jschardet，支持 UTF-8/GBK/Shift-JIS

## 截图

![主窗口截图](./public/screenshots/main_window.png)

**双栏编辑模式**：左侧 CodeMirror 6 编辑器，右侧 markdown-it 实时预览，底部状态栏显示编辑信息。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+N` | 新建文件 |
| `Ctrl+O` | 打开文件 |
| `Ctrl+S` | 保存文件 |
| `Ctrl+Shift+S` | 另存为 |
| `Ctrl+\` | 切换侧边栏 |
| `Ctrl+Shift+F` | 全局搜索 |
| `Ctrl+Shift+P` | 切换编辑模式 (split ↔ wysiwyg) |
| `Ctrl+Shift+O` | 切换预览模式 |
| `Ctrl+Shift+I` | 插件管理 |
| `F11` | 专注模式 |
| `F12` | 打字机模式 |
| `Ctrl+B` | 加粗 `**text**` |
| `Ctrl+I` | 斜体 `*text*` |
| `Ctrl+K` | 插入链接 |
| `` Ctrl+` `` | 行内代码 |
| `` Ctrl+Shift+` `` | 代码块 |
| `Ctrl+Shift+M` | 公式块 |
| `Ctrl+Shift+L` | 无序列表 |
| `Ctrl+Shift+[` | 引用块 |
| `Ctrl+Shift+H` | 导出 HTML |
| `Ctrl+Shift+E` | 导出 PDF |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发模式（Vite HMR + Electron 热重启）
npm run dev

# 类型检查
npm run typecheck

# 运行单元/集成测试（115 tests）
npm test

# 运行 E2E 测试（14 tests，需先构建）
npm run build
npm run test:e2e

# 生产构建
npm run build

# 打包安装包
npm run pack:win    # Windows .exe
npm run pack:mac    # macOS .dmg
npm run pack:linux  # Linux .AppImage
```

## 技术栈

| 层级 | 选型 |
|------|------|
| 桌面框架 | Electron 28 |
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite 5 + vite-plugin-electron |
| 编辑器内核 | CodeMirror 6 |
| Markdown 解析 | markdown-it + markdown-it-texmath |
| 代码高亮 | highlight.js |
| 数学公式 | KaTeX |
| 图表渲染 | Mermaid |
| 状态管理 | Zustand |
| 沙箱安全 | DOMPurify |
| DOM 增量 | morphdom |
| 编码检测 | jschardet + iconv-lite |
| 测试框架 | Vitest + Playwright |

## 项目结构

```
confucius/
├── electron/                       # 主进程 (Node.js)
│   ├── main.ts                     # 窗口创建、生命周期、文件拖拽打开
│   ├── menu.ts                     # 原生菜单
│   ├── preload.ts                  # contextBridge 安全 API
│   ├── ipc-handlers.ts             # IPC 通道注册
│   └── services/
│       ├── file-service.ts         # 文件读写（路径安全校验）
│       ├── file-watcher.ts         # 文件变更监听
│       ├── export-service.ts       # HTML/PDF 导出
│       ├── search-service.ts       # 并行全文搜索
│       ├── scanner-service.ts      # 插件目录扫描
│       └── encoding-detector.ts    # 编码自动检测
│
├── src/                            # 渲染进程 (React)
│   ├── main.tsx                    # React 入口
│   ├── App.tsx                     # 根组件（菜单动作分发）
│   │
│   ├── components/
│   │   ├── Editor/                 # 编辑器组件
│   │   │   ├── EditorPane.tsx      # CM6 封装
│   │   │   ├── EditorLayout.tsx    # 三模式布局（split/wysiwyg/preview）
│   │   │   ├── ResizablePane.tsx   # 可拖拽面板
│   │   │   ├── FormatToolbar.tsx   # 格式化工具栏
│   │   │   ├── ModeSwitch.tsx      # 模式切换按钮
│   │   │   ├── TabBar.tsx          # 标签栏
│   │   │   └── StatusBar.tsx       # 底部状态栏
│   │   ├── Preview/
│   │   │   └── PreviewPane.tsx     # Markdown 预览（morphdom 增量）
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx         # 容器（标签切换）
│   │   │   ├── FileTreePanel.tsx   # 文件树
│   │   │   ├── OutlinePanel.tsx    # 大纲（点击跳转编辑+预览）
│   │   │   └── SearchPanel.tsx     # 全局搜索
│   │   └── Settings/
│   │       ├── ThemeSelector.tsx   # 主题选择器
│   │       ├── PluginManagerDialog.tsx  # 插件管理 UI
│   │       └── AboutDialog.tsx     # 关于对话框
│   │
│   ├── editor/
│   │   ├── cm6-setup.ts            # CM6 配置
│   │   ├── keybindings.ts          # 编辑器快捷键
│   │   ├── markdown-renderer.ts    # markdown-it + texmath
│   │   ├── mermaid-renderer.ts     # Mermaid 图表渲染
│   │   ├── outline-parser.ts       # 标题提取
│   │   ├── active-view.ts          # CM6 视图引用
│   │   ├── focus-mode.ts           # 专注模式
│   │   ├── typewriter-mode.ts      # 打字机模式
│   │   ├── large-file-handler.ts   # 大文件检测
│   │   ├── sync-scroll.ts          # 编辑/预览滚动同步
│   │   └── wysiwyg-plugin.ts       # WYSIWYG CM6 扩展
│   │
│   ├── engine/                     # 插件引擎（零宿主引用）
│   │   ├── PluginEngine.ts         # 引擎核心
│   │   ├── HostAPIBridge.ts        # 宿主适配器
│   │   ├── DependencyGraph.ts      # 依赖图（拓扑排序）
│   │   ├── EventBus.ts             # 事件总线
│   │   ├── ConfigDB.ts             # 配置持久化
│   │   ├── SandboxFactory.ts       # 沙箱执行器
│   │   ├── ScannerIPC.ts           # 目录扫描 IPC
│   │   └── types/
│   │       ├── host-api.ts         # HostAPIBridge 接口
│   │       └── plugin.ts           # 插件类型定义
│   │
│   ├── plugins/builtins/
│   │   ├── status-bar-info.tsx     # 内置状态栏插件
│   │   └── status-bar/
│   │       └── manifest.json       # 插件清单
│   │
│   ├── services/
│   │   ├── theme-service.ts        # 主题管理
│   │   └── electron-bridge.ts      # IPC 调用封装
│   │
│   ├── stores/
│   │   ├── app-store.ts            # 应用配置（版本/侧边栏）
│   │   ├── editor-store.ts         # 编辑器状态
│   │   ├── tab-store.ts            # 多标签管理
│   │   ├── sidebar-store.ts        # 侧边栏状态
│   │   └── plugin-store.ts         # 插件 UI 状态
│   │
│   ├── styles/
│   │   ├── global.css              # CSS 变量 + 基础重置
│   │   ├── editor.css              # 编辑器/分栏样式
│   │   ├── preview.css             # Markdown 预览
│   │   ├── sidebar.css             # 侧边栏
│   │   ├── dialog.css              # 对话框（插件管理/关于）
│   │   ├── status-bar.css          # 状态栏
│   │   └── wysiwyg.css             # WYSIWYG 装饰样式
│   │
│   ├── utils/
│   │   ├── path.ts                 # 路径工具
│   │   ├── sanitize.ts             # DOMPurify 封装
│   │   └── dom-diff.ts             # morphdom 增量更新
│   │
│   └── types/
│       ├── electron.d.ts           # ElectronAPI 类型
│       ├── file.ts                 # 文件结果类型
│       ├── file-tree.ts            # 文件树类型 + flattenTree
│       └── search.ts               # 搜索类型
│
├── plugins/                        # 插件目录
│   ├── types/plugin.d.ts           # TypeScript 类型定义
│   ├── builtins/                   # 内置插件（打包到安装包）
│   │   ├── status-bar/             # 状态栏配置
│   │   ├── doc-templates/          # 文档模板插件
│   │   │   ├── manifest.json
│   │   │   ├── index.js
│   │   │   ├── templates.json
│   │   │   ├── style.css
│   │   │   └── README.md
│   │   └── code-runner/            # 代码运行器插件
│   │       ├── manifest.json
│   │       ├── index.js
│   │       ├── style.css
│   │       └── README.md
│   ├── status-bar-plus/            # 状态栏扩展插件（示例）
│   ├── doc-stats/                  # 文档统计插件（示例）
│   └── writing-aid/                # 写作辅助插件（示例）
│
├── themes/                         # 主题 CSS 变量
│   ├── plain-white.css              # 浅色·素白纸
│   ├── eye-care.css                 # 浅色·护眼
│   ├── cloud.css                    # 浅色·云白
│   ├── mint.css                     # 浅色·薄荷
│   ├── night-black.css              # 深色·暗夜黑
│   ├── deep-sea.css                 # 深色·深海
│   └── warm-gray.css                # 深色·暖灰
│
├── test/                           # 测试（115 单元/集成 + 14 E2E）
│   ├── setup.ts                    # 全局 setup + mock ElectronAPI
│   ├── unit/                       # 单元测试
│   ├── integration/                # 集成测试
│   └── e2e/                        # E2E 测试（14 tests）
│
├── .github/workflows/              # CI/CD
│   ├── ci.yml                      # lint + typecheck + 单元测试
│   ├── e2e.yml                     # E2E 测试
│   └── release.yml                 # 三平台打包
│
├── docs/                           # 设计文档
│   ├── Testing-Plan.md
│   ├── Future-Roadmap.md
│   ├── Plugin-System.md
│   └── Plugin-Dev-Guide.md
│
├── package.json
├── vite.config.mts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
└── electron-builder.yml
```

## 开发状态

| 阶段 | 状态 | 内容 |
|------|------|------|
| Phase 1 | ✅ 完成 | 项目骨架、Electron + Vite + React、IPC 通信 |
| Phase 2 | ✅ 完成 | CM6 编辑器、双栏预览、文件新建/打开/保存 |
| Phase 3 | ✅ 完成 | 代码高亮、公式、侧边栏（文件树/大纲/搜索）、快捷键、标签栏 |
| Phase 4 | ✅ 完成 | HTML/PDF 导出、主题系统、Mermaid、文件监听 |
| Phase 5 | ✅ 完成 | WYSIWYG 即时渲染、格式化工具栏、专注/打字机模式 |
| Phase 6 | ✅ 完成 | DOMPurify XSS 防护、morphdom 增量渲染、大文件处理 |
| — | | |
| 插件系统 v3 | ✅ 完成 | PluginEngine、HostAPIBridge 解耦、依赖管理、事件总线、沙箱执行、配置持久化、插件管理 UI |
| 纯预览模式 | ✅ 完成 | 全屏阅读/切换/滚动同步 |
| 技术债务 | ✅ 完成 | CSS Modules 迁移、dead code 清理、状态精简、IPC 简化 |
| 单元/集成测试 | ✅ 完成 | 115 tests / 20 files |
| E2E 测试 | ✅ 完成 | 14 tests (Playwright + Electron) |
| CI/CD | ✅ 完成 | GitHub Actions (ci.yml / e2e.yml / release.yml) |
| 文件拖拽打开 | ✅ 完成 | 拖拽 .md 文件到应用图标直接打开 |
| — | | |
| 插件生态增强 | ✅ 完成 | TypeScript 类型定义、文档模板插件、代码运行器插件 |
| 插件开发文档 | ✅ 完成 | Plugin-Dev-Guide.md 扩展（调试指南、发布流程、高级示例、API 详解） |

## License

MIT