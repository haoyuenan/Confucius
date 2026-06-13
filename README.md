# Confucius

> 本地 Markdown 知识库编辑器 — Tauri + React + CodeMirror 6 构建，支持双向链接与知识图谱

[English](./README_EN.md)

## 截图

![主窗口截图](docs/screenshots/main_window.png)

双栏编辑模式：左侧 CodeMirror 6 编辑器，右侧 markdown-it 实时预览，底部状态栏显示编辑信息。

## 功能

### 三种编辑模式
- **双栏实时预览** (split)：左侧源码编辑，右侧即时 Markdown 渲染（默认）
- **即时渲染模式** (WYSIWYG)：对标题、加粗/斜体/删除线、行内代码、无序列表、引用隐藏语法标记，光标附近恢复显示
- **纯预览模式**：全屏阅读，居中布局（`Ctrl+Shift+O`）

### 知识库
- **双向链接**：`[[笔记标题]]` 自动补全与语法高亮，Ctrl+点击跳转
- **反链面板**：侧边栏查看当前笔记的被引用列表
- **标签系统**：行内 `#tag` + YAML frontmatter 标签，层级标签面板浏览
- **全局知识图谱**：D3.js 力导向图，支持全局/局部模式、拖拽、缩放、点击跳转
- **快速打开**：`Ctrl+O` 模糊搜索文件名和标题
- **Daily Notes**：一键创建今日笔记，按 `日记/YYYY/MM/YYYY-MM-DD.md` 归档，自动填充 frontmatter

### 编辑器
- **格式化工具栏**：撤销/重做、标题、加粗/斜体/删除线、引用/代码块/列表、链接/图片/分割线/公式/表格、专注/打字机模式
- **表格插入**：工具栏按钮，弹窗选择行列数，自动生成 Markdown 表格模板
- **CodeMirror 6 内核**：高性能文本编辑，Markdown 语法高亮
- **查找替换**：`Ctrl+F` 搜索，`Ctrl+Shift+F` 替换，F3 跳转下一处，选中词自动高亮所有匹配
- **代码高亮**：支持 33 种常用语言（highlight.js），未注册语言自动降级检测
- **数学公式**：KaTeX 渲染 `$...$` 行内公式和 `$$...$$` 块级公式
- **图表支持**：Mermaid 流程图、时序图、甘特图等
- **GFM 兼容**：任务列表、表格等
- **粘贴/拖拽图片**：从文件管理器复制或拖拽图片到编辑器，自动插入 `![文件名](path)` Markdown 语法
- **专注模式** (F11)：非活动行半透明
- **打字机模式** (F12)：编辑行始终视口居中

### 文件管理
- **欢迎屏（零状态）**：首次启动时显示欢迎画面，含「打开文件夹」和「新建笔记」快捷入口
- **最近文件**：自动记录最近打开的文件（最多 10 条），欢迎屏一键重新打开
- **快捷工具栏**：新建、打开、今日笔记、切换侧边栏、搜索、主题切换、导出、编辑/预览模式、设置
- **文件树侧边栏**：浏览和打开文件夹内的 Markdown 文件
- **大纲面板**：自动提取标题结构，点击跳转编辑器和预览区
- **全局搜索**：跨文件全文搜索（Rust 并行引擎）
- **文件操作**：新建、打开、保存、另存为、**自动保存**（每 5 秒自动保存未保存的修改）
- **侧边栏右键菜单**：新建文件/目录、重命名、删除

### 视图 & 外观
- **十二套主题**：浅色 6 套 / 深色 6 套，持久化 localStorage，工具栏一键切换 + 下拉选主题（含色条预览）
- **命令面板**：`Ctrl+E` 打开模糊搜索命令面板，支持键盘导航、最近使用历史
- **工作区恢复**：自动保存标签页、侧边栏状态、主题等设置，下次启动一键恢复
- **国际化**：完整的中文 ↔ English 语言切换，实时生效
- **品牌标题栏**：左侧显示应用名称，工具栏居右排列
- **统一设置面板**：通用设置、主题管理与预览、快捷键速查表、关于信息
- **可拖拽分栏**：双栏宽度自由调节
- **滚动同步**：双栏模式下编辑区与预览区滚动百分比同步

### 导出
- **HTML 导出**：生成独立 HTML 文件，`[[链接]]` 转为超链接
- **PDF 导出**：通过系统打印对话框手动另存为 PDF

### 状态栏
- **状态栏**：底部显示保存状态、字数统计（含选中字符数）、光标位置（行:列）

### 安全
- **XSS 防护**：DOMPurify 白名单过滤
- **路径校验**：拒绝 `..` 遍历和空字节注入

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+N` | 新建文件 |
| `Ctrl+O` | 快速打开/搜索笔记 |
| `Ctrl+S` | 保存文件 |
| `Ctrl+Shift+S` | 另存为 |
| `Ctrl+F` | 文档内查找 |
| `Ctrl+E` | 命令面板 |
| `Ctrl+Shift+F` | 全局搜索 |
| `Ctrl+\` | 切换侧边栏 |
| `Ctrl+Shift+P` | 切换编辑模式 (split ↔ wysiwyg) |
| `Ctrl+Shift+O` | 切换预览模式 |
| `Ctrl+Shift+D` | 创建/打开今日笔记 |
| `Ctrl+Shift+G` | 打开知识图谱 |
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

# 启动开发模式（Tauri + Vite HMR）
npm run dev

# 类型检查
npm run typecheck

# 运行单元/集成测试
npm test

# 构建生产版本
npm run build:tauri
```

## 技术栈

| 层级 | 选型 |
|------|------|
| 桌面框架 | Tauri 2 (Rust + WebView) |
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite 5 + @tauri-apps/cli |
| 编辑器内核 | CodeMirror 6 |
| Markdown 解析 | markdown-it + markdown-it-texmath |
| 代码高亮 | highlight.js（33 种常用语言） |
| 数学公式 | KaTeX |
| 图表渲染 | Mermaid |
| 知识图谱 | D3.js (d3-force) |
| 状态管理 | Zustand |
| 沙箱安全 | DOMPurify |
| DOM 增量 | morphdom |
| 后端 | Rust（文件 I/O、搜索、文件监听） |
| 测试框架 | Vitest |

## 项目结构

```
confucius/
├── src-tauri/                      # Tauri Rust 后端
│   ├── Cargo.toml                  # Rust 依赖
│   ├── tauri.conf.json             # Tauri 配置
│   ├── capabilities/default.json   # 权限声明
│   └── src/
│       ├── main.rs                 # 入口
│       └── lib.rs                  # Rust 命令（文件I/O/搜索/监听）
│
├── src/                            # 前端 (React + TypeScript)
│   ├── main.tsx                    # React 入口
│   ├── App.tsx                     # 根组件
│   ├── i18n/                       # 国际化（中英双语）
│   ├── components/
│   │   ├── CommandPalette/         # 命令面板 + 快速打开
│   │   ├── Editor/                 # 编辑器组件
│   │   ├── Preview/                # 预览组件
│   │   ├── Sidebar/                # 侧边栏（文件树/大纲/搜索/反链/标签/图谱）
│   │   └── Settings/               # 设置面板
│   ├── services/
│   │   ├── electron-bridge.ts      # Tauri IPC 封装层
│   │   ├── command-registry.ts     # 内置命令 + 模糊搜索
│   │   ├── workspace-store.ts      # 工作区会话保存/恢复
│   │   ├── theme-service.ts        # 主题管理（12 套主题）
│   │   ├── knowledge-service.ts    # 知识库索引引擎（前端）
│   │   └── recent-files.ts         # 最近文件
│   ├── stores/                     # Zustand 状态（5 个 Store）
│   ├── editor/                     # CM6 扩展与编辑器工具
│   └── styles/                     # CSS 样式
│
├── themes/                         # 主题 CSS 变量（12 套）
├── test/                           # 测试
├── docs/                           # 设计文档 & 截图
├── package.json
├── vite.config.mts
└── tsconfig.json
```

## 从 Electron 迁移

v0.5.2 稳定性修复与 UI 改进：

- **图片预览修复**：用 Rust `read_file_base64` + base64 data URI 替代 Tauri asset 协议，彻底解决图片加载问题
- **打印修复**：预览内容使用隐藏 iframe 独立文档打印，绕过主窗口 overflow 限制
- **文件树优化**：跳过不含 `.md` 文件的空目录
- **UI 改进**：打开文件夹时显示"正在遍历文件夹…"；搜索/侧边按钮逻辑分离；工具栏字体增大；窗口启动居中
- **迁移清理**：移除所有 Electron 残留代码、翻译键、测试 mock

v0.5.0 从 Electron 28 迁移至 Tauri 2，主要变化：

- **安装包体积**：~72 MB（Electron NSIS）→ **约 8 MB**（Tauri）
- **内存占用**：~200 MB → **约 60 MB**
- **启动速度**：1-3 秒 → **< 1 秒**
- **后端语言**：Node.js → **Rust**
- **原生菜单**：移除，使用 Web 工具栏替代
- **PDF 导出**：Electron printToPDF → 系统打印对话框
- **插件系统**：移除（引擎 + 外部插件）
- **编码检测**：jschardet + iconv-lite → Rust 直接读取 UTF-8

## 开发状态

v0.5.2 修复了图片预览、打印等问题，优化了文件树和 UI 细节。此后进入功能迭代阶段。

## License

MIT
