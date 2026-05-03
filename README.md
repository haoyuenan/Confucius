# Confucius

> 本地 Markdown 编辑器 — 灵感来自 Typora，使用 Electron + React + CodeMirror 6 构建。

## 功能

### 编辑器
- **双栏实时预览**：左侧源码编辑，右侧即时 Markdown 渲染
- **即时渲染模式 (WYSIWYG)**：编辑区内隐藏语法标记，光标附近恢复显示，所见即所得
- **格式化工具栏**：标题(H₁/H₂/H₃)、加粗/斜体/删除线、引用/代码块/列表、链接/图片/分割线
- **CodeMirror 6 内核**：高性能文本编辑，Markdown 语法高亮
- **快捷键**：`Ctrl+B` 加粗、`Ctrl+I` 斜体、`Ctrl+K` 链接、`` Ctrl+` `` 行内代码等
- **代码高亮**：支持 190+ 语言（highlight.js）
- **数学公式**：KaTeX 渲染 `$...$` 行内公式和 `$$...$$` 块级公式
- **图表支持**：Mermaid 流程图、时序图、甘特图等（` ```mermaid `）
- **GFM 兼容**：任务列表、表格、脚注等
- **专注模式**：F11 — 非活动行半透明，聚焦当前编辑行
- **打字机模式**：F12 — 编辑行始终视口居中，需专注模式开启

### 文件管理
- **文件树侧边栏**：浏览和打开文件夹内的 Markdown 文件
- **大纲面板**：自动提取文档标题结构，点击跳转编辑位置
- **全局搜索**：跨文件全文搜索，防抖 300ms，结果高亮
- **文件操作**：新建、打开、保存、另存为
- **右键菜单**：文件树右键新建文件/目录、重命名、删除

### 导出
- **HTML 导出**：生成独立 HTML 文件，样式完整
- **PDF 导出**：通过 Electron printToPDF 生成 A4 文档

### 安全
- **XSS 防护**：DOMPurify 白名单过滤，阻止 HTML 注入
- **路径校验**：拒绝 `..` 路径遍历和空字节注入
- **Mermaid 严格模式**：阻止图表中的点击事件注入

### 主题
- **亮色**：默认白色主题
- **暗色**：VS Code 风格暗色主题
- **护眼**：羊皮纸暖色主题
- 主题持久化（localStorage），自动联动 highlight.js 和 Mermaid 主题

### 高级特性
- 文件修改检测，切换文件时自动提示保存
- 文件变更自动监听（fs.watch），外部修改后文件树自动刷新
- 分栏宽度可拖拽调整
- 编码自动检测（BOM + jschardet），支持 GBK/Shift-JIS 等

## 技术栈

| 层级 | 选型 |
|------|------|
| 桌面框架 | Electron 28 |
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite 5 + vite-plugin-electron |
| 编辑器内核 | CodeMirror 6 |
| Markdown 解析 | markdown-it |
| 代码高亮 | highlight.js |
| 数学公式 | KaTeX |
| 图表渲染 | Mermaid |
| 状态管理 | Zustand |
| 打包工具 | electron-builder |
| Markdown 样式 | github-markdown-css |

## 快速开始

```bash
# 克隆项目
cd confucius

# 安装依赖
npm install

# 启动开发模式（支持 HMR + 主进程热重启）
npm run dev

# 类型检查
npm run typecheck

# 生产构建
npm run build

# 打包 Windows 安装包
npm run pack:win

# 打包 macOS DMG
npm run pack:mac

# 打包 Linux AppImage
npm run pack:linux
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+N` | 新建文件 |
| `Ctrl+O` | 打开文件 |
| `Ctrl+S` | 保存文件 |
| `Ctrl+Shift+S` | 另存为 |
| `Ctrl+\` | 切换侧边栏 |
| `Ctrl+Shift+F` | 全局搜索 |
| `Ctrl+B` | 加粗 `**text**` |
| `Ctrl+I` | 斜体 `*text*` |
| `Ctrl+K` | 插入链接 `[text](url)` |
| `` Ctrl+` `` | 行内代码 `` `code` `` |
| `` Ctrl+Shift+` `` | 代码块 |
| `Ctrl+Shift+M` | 公式块 `$$ formula $$` |
| `Ctrl+Shift+L` | 无序列表 |
| `Ctrl+Shift+O` | 有序列表 |
| `Ctrl+Shift+[` | 引用块 |
| `Ctrl+Shift+H` | 导出为 HTML |
| `Ctrl+Shift+E` | 导出为 PDF |
| `Ctrl+Shift+P` | 切换编辑模式 |
| `F11` | 专注模式 |
| `F12` | 打字机模式 |

## 项目结构

```
confucius/
├── electron/                     # 主进程 (Node.js)
│   ├── main.ts                   # 应用入口：窗口创建、生命周期
│   ├── menu.ts                   # 原生菜单
│   ├── preload.ts                # contextBridge 安全 API
│   ├── ipc-handlers.ts           # IPC 通道注册
│   └── services/
│       ├── export-service.ts     # HTML/PDF 导出
│       ├── file-watcher.ts       # 文件变更监听
│       └── search-service.ts     # 全局搜索
│
├── src/                          # 渲染进程 (React)
│   ├── main.tsx                  # React 入口
│   ├── App.tsx                   # 根组件
│   │
│   ├── components/
│   │   ├── Editor/               # 编辑器组件
│   │   │   ├── EditorPane.tsx     # CM6 封装
│   │   │   ├── ResizablePane.tsx # 可拖拽面板
│   │   │   └── EditorLayout.tsx  # 双栏布局
│   │   ├── Preview/
│   │   │   └── PreviewPane.tsx   # Markdown 预览
│   │   ├── Sidebar/              # 侧边栏
│   │   │   ├── Sidebar.tsx       # 容器（标签切换）
│   │   │   ├── FileTreePanel.tsx # 文件树
│   │   │   ├── OutlinePanel.tsx  # 大纲
│   │   │   └── SearchPanel.tsx   # 全局搜索
│   │   └── Settings/
│   │       └── ThemeSelector.tsx # 主题选择器
│   │
│   ├── editor/
│   │   ├── cm6-setup.ts          # CM6 配置
│   │   ├── keybindings.ts        # 编辑器快捷键
│   │   ├── markdown-renderer.ts  # markdown-it + highlight.js
│   │   ├── mermaid-renderer.ts   # Mermaid 图表渲染
│   │   └── outline-parser.ts     # 标题提取
│   │
│   ├── services/
│   │   └── theme-service.ts      # 主题管理
│   │
│   ├── stores/
│   │   ├── app-store.ts          # 应用 + 文件操作状态
│   │   ├── editor-store.ts       # 编辑器状态
│   │   └── sidebar-store.ts      # 侧边栏状态
│   │
│   ├── styles/
│   │   ├── global.css            # 全局样式 + CSS 变量
│   │   ├── editor.css            # 编辑器/分栏样式
│   │   ├── preview.css           # Markdown 预览样式
│   │   └── sidebar.css           # 侧边栏样式
│   │
│   └── types/
│       ├── electron.d.ts         # ElectronAPI 类型
│       ├── file.ts               # 文件操作类型
│       ├── file-tree.ts          # 文件树类型
│       └── search.ts             # 搜索类型
│
├── themes/                       # 主题 CSS 变量
│   ├── light.css
│   ├── dark.css
│   └── sepia.css
│
├── docs/                         # 设计文档
│   ├── Requirements.md
│   ├── Architecture.md
│   ├── DevelopmentPlan.md
│   └── design/
│       ├── Phase01-Foundation.md
│       ├── Phase02-MVP-Editor.md
│       ├── Phase03-CoreFeatures.md
│       ├── Phase04-ExtendedFeatures.md
│       └── Phase05-Advanced.md
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── electron-builder.yml
```

## 架构

```
┌─────────────────────────────────────────────────┐
│              主进程 (electron/)                    │
│  ┌──────────┐  ┌─────────┐  ┌────────────────┐  │
│  │ main.ts  │  │ menu.ts │  │ ipc-handlers.ts │  │
│  └────┬─────┘  └─────────┘  └───────┬────────┘  │
│       │                              │            │
│  preload.ts (contextBridge)          │            │
│  ┌────────────────────┐              │            │
│  │  FileService       │  ← IPC ──── │            │
│  │  SearchService     │             │            │
│  │  ExportService     │             │            │
│  │  FileWatcher       │             │            │
│  └────────────────────┘              │            │
└──────────────┬───────────────────────┘            │
               │ IPC (invoke/handle)                 │
┌──────────────▼───────────────────────────────────────┐
│               渲染进程 (src/)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  侧边栏       │  │  CM6 编辑器  │  │ 预览面板   │  │
│  │  (文件树/大纲 │  │  markdown-it │  │ highlight │  │
│  │   /搜索)      │  │  + 快捷键    │  │ KaTeX     │  │
│  │              │  │              │  │ Mermaid   │  │
│  └──────────────┘  └──────────────┘  └───────────┘  │
└─────────────────────────────────────────────────────┘
```

## 开发阶段

| 阶段 | 状态 | 内容 |
|------|------|------|
| Phase 1 | ✅ 完成 | 项目骨架、Electron + Vite + React 搭建、IPC 通信 |
| Phase 2 | ✅ 完成 | CM6 编辑器、双栏预览、文件新建/打开/保存 |
| Phase 3 | ✅ 完成 | 代码高亮、公式、侧边栏（文件树/大纲/搜索）、快捷键 |
| Phase 4 | ✅ 完成 | HTML/PDF 导出、主题系统、Mermaid 图表 |
| Phase 5-1 | ✅ 完成 | 即时渲染 WYSIWYG、格式化工具栏 |
| Phase 5-2 | ✅ 完成 | 专注/打字机模式、DOMPurify XSS 防护、morphdom 增量渲染 |

## License

MIT
