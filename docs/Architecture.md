# 技术架构概览

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 桌面框架 | Tauri 2 (Rust) | WebView + Rust 后端双进程 |
| 前端 | React 18 + TypeScript | 组件化 UI |
| 构建 | Vite 5 + Tauri CLI | HMR + Rust 编译 |
| 编辑器 | CodeMirror 6 | Markdown 编辑内核 |
| Markdown 渲染 | markdown-it + 插件 | GFM、Task List、KaTeX |
| 代码高亮 | highlight.js (33 语言) | — |
| 数学公式 | KaTeX | 行内 + 块级 |
| 图表 | Mermaid | 流程图、时序图等 |
| 状态管理 | Zustand | 5 个 Store |
| 安全防护 | DOMPurify | XSS 过滤 |
| DOM 更新 | morphdom | 预览区增量更新 |
| 测试 | Vitest + Playwright | 单元/集成/E2E |
| 打包 | Tauri Builder | Windows/macOS/Linux (约 8 MB) |

## 进程架构

```
Rust 后端 (src-tauri/src/lib.rs)
├── build_file_tree        # 递归文件树（跳过空目录）
├── search_text             # 并行全文搜索（8 线程）
├── read_file_utf8          # 读 UTF-8 文件
├── write_file_utf8         # 写文件
├── read_file_base64        # 读二进制文件为 base64（图片预览）
├── create_file / create_dir / rename_item / delete_item
├── stat_file / read_dir_entries
├── start_file_watcher / stop_file_watcher  # notify crate 文件监听
└── get_app_version

前端 WebView (src/)
├── App.tsx                 # 根组件、工具栏、快捷键、命令面板
├── main.tsx                # 入口
├── i18n/
│   ├── i18n-store.ts       # Zustand store + useTranslation hook
│   ├── zh.json             # 中文翻译
│   └── en.json             # 英文翻译
├── components/
│   ├── CommandPalette/     # Ctrl+E 命令面板（模糊搜索 + 键盘导航）
│   ├── Editor/             # 编辑器布局/面板/工具栏/标签栏
│   ├── Preview/            # Markdown 预览（含图片 base64 加载）
│   ├── Sidebar/            # 文件树/大纲/搜索/反链/标签/知识图谱
│   ├── Settings/           # 主题/语言/快捷键/关于
│   └── DailyNoteButton/    # 今日笔记
├── editor/
│   ├── cm6-setup.ts        # CM6 初始化
│   ├── keybindings.ts      # 编辑器快捷键
│   ├── format-helpers.ts   # 格式化函数
│   ├── markdown-renderer.ts # markdown-it + texmath + sanitize
│   ├── mermaid-renderer.ts # Mermaid 渲染
│   ├── wysiwyg-plugin.ts   # WYSIWYG 模式
│   ├── focus-mode.ts       # 专注模式
│   ├── typewriter-mode.ts   # 打字机模式
│   ├── sync-scroll.ts      # 编辑/预览滚动同步
│   ├── outline-parser.ts   # 大纲提取
│   ├── active-view.ts      # 模块级 EditorView 引用
│   └── large-file-handler.ts # 大文件检测
├── services/
│   ├── electron-bridge.ts  # Tauri invoke() 封装层
│   ├── knowledge-service.ts # 知识库引擎（维基链接/标签/图谱）
│   ├── theme-service.ts    # 主题切换
│   ├── workspace-store.ts  # 工作区会话持久化
│   ├── command-registry.ts # 命令注册与模糊搜索
│   └── recent-files.ts     # 最近文件
├── stores/
│   ├── app-store.ts        # 应用配置
│   ├── editor-store.ts     # 编辑器状态
│   ├── sidebar-store.ts    # 侧边栏状态（含文件树加载状态）
│   ├── tab-store.ts        # 多标签管理
│   └── knowledge-store.ts  # 知识库数据
├── utils/
│   ├── sanitize.ts         # DOMPurify 配置
│   ├── dom-diff.ts         # morphdom 增量更新
│   └── path.ts             # 路径工具
└── styles/
    ├── global.css          # CSS 变量 + 基础重置
    ├── editor.css          # 编辑器/分栏
    ├── preview.css         # Markdown 预览
    ├── sidebar.css         # 侧边栏
    ├── dialog.css          # 对话框
    ├── status-bar.css      # 状态栏
    └── wysiwyg.css         # WYSIWYG 装饰样式
```

## Tauri 命令（替代 Electron IPC）

| 命令 | 说明 |
|------|------|
| `build_file_tree` | 递归构建 .md 文件树，跳过无 .md 文件的空目录 |
| `search_text` | 并行全文搜索（8 线程，支持正则/大小写） |
| `read_file_utf8` | 读取 UTF-8 文件（前端去 BOM） |
| `write_file_utf8` | 写入文件（自动创建父目录） |
| `read_file_base64` | 读取二进制文件，返回 data: base64 URI（图片预览） |
| `create_file` / `create_dir` | 新建文件/目录 |
| `rename_item` / `delete_item` | 重命名/删除 |
| `stat_file` | 文件元信息 |
| `read_dir_entries` | 目录条目列表 |
| `start_file_watcher` / `stop_file_watcher` | 文件变更监听（notify crate，500ms 防抖） |
| `get_app_version` | 返回版本号 |

所有命令通过 `@tauri-apps/api/core` 的 `invoke()` 调用。桥接层在 `src/services/electron-bridge.ts` 统一封装。

## 关键数据流

### 文件打开

```
文件树点击 → bridge.readFile()
  → invoke('read_file_utf8') → Rust → fs.read_to_string
  → tab-store.openFile(filePath, content)
  → EditorPane dispatch 到 CM6
  → PreviewPane renderMarkdown() → morphdom 增量更新
  → 异步：bridge.readFileBase64() → 图片 data URI
```

### 编辑 → 预览

```
CM6 updateListener (150ms 防抖)
  → format-helpers → dispatch changes
  → editor-store.setContent()
  → PreviewPane useMemo → renderMarkdown()
  → morphdom 增量更新
  → renderMermaidDiagrams()（大文件跳过）
  → 异步图片 base64 加载
```

### 模式切换

```
工具栏 / 快捷键 Ctrl+Shift+P
  → editor-store.toggleMode()
  → EditorLayout 根据 mode 渲染 split/wysiwyg/preview
  → key={activeTabId} 触发 CM6 重建
```

### 打印

```
🖨 按钮 → bridge.printPreview()
  → 获取 previewRef.innerHTML（__exportPreviewHTML__）
  → 构建独立 HTML 文档
  → 写入隐藏 iframe
  → iframe.contentWindow.print()
  → onafterprint 清理
```

## 文件监听

- 使用 Rust `notify` crate（v7），递归监听
- 500ms 防抖，通过 `file-tree-changed` 事件通知前端
- 前端收到事件后重新调用 `build_file_tree` 更新侧边栏树
- 线程通过 `AtomicBool` 安全停止

## 主题系统

12 个主题 CSS 文件定义亮色/暗色模式变量：
- 浅色：plain-white、warm-sun、cloud、mint、tokyo-night-light、rose-pine-dawn
- 深色：night-black、deep-sea、warm-gray、mo-zhu、tokyo-night、rose-pine

ThemeService 通过 `document.documentElement.dataset.theme` 切换，同时联动 highlight.js 和 Mermaid 主题。

## 知识库引擎

`src/services/knowledge-service.ts` — 纯前端实现：
- 解析 `[[维基链接]]`、`#标签`、YAML frontmatter
- 索引存储在 `.confucius/index.json`（工作区隐藏目录）
- 打开工作区时全量扫描，文件变更时增量更新
- 提供反链、图谱数据、标签浏览、文件搜索、维基链接解析

## 构建与部署

```bash
npm run dev          # 开发模式（Vite HMR + Tauri WebView）
npm run build        # TypeScript 检查 + Vite 生产构建
npm run build:tauri  # 完整 Tauri 构建（前端 + Rust 编译）
```

输出目录：`dist-release/`，约 8 MB 安装包。
