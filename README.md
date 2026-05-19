# Confucius

> 本地 Markdown 编辑器 — Electron + React + CodeMirror 6 构建，支持插件扩展

[English](./README_EN.md)

## 截图

![主窗口截图](docs/screenshots/main_window.png)

双栏编辑模式：左侧 CodeMirror 6 编辑器，右侧 markdown-it 实时预览，底部状态栏显示编辑信息。

## 功能

### 三种编辑模式
- **双栏实时预览** (split)：左侧源码编辑，右侧即时 Markdown 渲染（默认）
- **即时渲染模式** (WYSIWYG)：对标题、加粗/斜体/删除线、行内代码、无序列表、引用隐藏语法标记，光标附近恢复显示
- **纯预览模式**：全屏阅读，居中布局（`Ctrl+Shift+O`）

### 编辑器
- **格式化工具栏**：撤销/重做、标题、加粗/斜体/删除线、引用/代码块/列表、链接/图片/分割线/公式/表格、专注/打字机模式
- **表格插入**：工具栏「⊞ 表格」按钮，弹窗选择行列数，自动生成对齐的 Markdown 表格模板
- **CodeMirror 6 内核**：高性能文本编辑，Markdown 语法高亮
- **查找替换**：`Ctrl+F` 搜索，`Ctrl+Shift+F` 替换，F3 跳转下一处，选中词自动高亮所有匹配
- **代码高亮**：支持 190+ 语言（highlight.js）
- **数学公式**：KaTeX 渲染 `$...$` 行内公式和 `$$...$$` 块级公式
- **图表支持**：Mermaid 流程图、时序图、甘特图等
- **GFM 兼容**：任务列表、表格等
- **粘贴/拖拽图片**：从文件管理器复制或拖拽图片到编辑器，自动插入 `![文件名](path)` Markdown 语法
- **粘贴 URL 转链接**：选中文字后粘贴 URL，自动转换为 `[文字](url)` 链接
- **专注模式** (F11)：非活动行半透明
- **打字机模式** (F12)：编辑行始终视口居中
- **右键菜单**：编辑区右键弹出保存/另存为/撤销/重做/剪切/复制/粘贴

### 文件管理
- **欢迎屏（零状态）**：首次启动时显示带文化气质的欢迎画面，含「打开文件夹」和「新建笔记」快捷入口
- **最近文件**：自动记录最近打开的文件（最多 10 条），欢迎屏一键重新打开
- **快捷工具栏**：新建、打开、切换侧边栏、搜索、主题切换、导出、编辑/预览模式、设置
- **文件树侧边栏**：浏览和打开文件夹内的 Markdown 文件
- **大纲面板**：自动提取标题结构，点击跳转编辑器和预览区
- **全局搜索**：跨文件全文搜索，防抖 300ms，并行读取
- **文件操作**：新建、打开、保存、另存为、**自动保存**（每 5 秒自动保存未保存的修改）
- **侧边栏右键菜单**：新建文件/目录、重命名、删除
- **拖拽打开**：拖拽 `.md` / `.markdown` 文件到应用图标直接打开

### 视图 & 外观
- **十二套主题**：浅色 6 套（素白纸、暖阳、云白、薄荷、东京夜白、玫瑰黎明）/ 深色 6 套（暗夜黑、深海、暖灰、墨竹、东京夜、玫瑰松），持久化 localStorage，工具栏一键切换浅/深模式 + 下拉选主题（含色条预览）
- **命令面板**：`Ctrl+E` 打开模糊搜索命令面板，支持键盘导航、最近使用历史、插件命令集成
- **工作区恢复**：自动保存标签页、侧边栏状态、主题等设置，下次启动一键恢复上次工作状态
- **国际化（i18n）**：完整的 中文 ↔ English 语言切换，设置 → 通用 → 语言 实时切换，所有 UI 组件、Electron 菜单、对话框即时生效
- **品牌标题栏**：左侧显示应用名称与副标语，工具栏居右排列
- **统一设置面板**：通用设置（专注/打字机/隐藏主菜单）、主题管理与预览、插件管理、快捷键速查表、关于信息
- **可拖拽分栏**：双栏宽度自由调节
- **滚动同步**：双栏模式下编辑区与预览区滚动百分比同步
- **侧边栏纸张纹理**：暖色主题下侧边栏叠加 CSS 生成的细腻颗粒感

### 导出
- **HTML 导出**：生成独立 HTML 文件
- **PDF 导出**：通过 Electron printToPDF 生成 A4 文档

### 状态栏 & 插件
- **状态栏**：底部显示保存状态（● 未保存 / ✓ 已保存）、字数统计（含选中字符数）、光标位置（行:列）
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
- **Python 执行确认**：运行代码前弹窗展示代码内容，需用户确认
- **编码检测**：BOM + jschardet，支持 UTF-8/GBK/Shift-JIS

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+N` | 新建文件 |
| `Ctrl+O` | 打开文件 |
| `Ctrl+S` | 保存文件 |
| `Ctrl+Shift+S` | 另存为 |
| `Ctrl+F` | 文档内查找 |
| `Ctrl+E` | 命令面板 |
| `Ctrl+Shift+F` | 全局搜索 |
| `Ctrl+\` | 切换侧边栏 |
| `Ctrl+Shift+P` | 切换编辑模式 (split ↔ wysiwyg) |
| `Ctrl+Shift+O` | 切换预览模式 |
| `Ctrl+Shift+I` | 插件管理（设置 → 插件） |
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

# 运行单元/集成测试（141 tests）
npm test

# 运行 E2E 测试（需先构建）
npm run build
npm run test:e2e

# 更新应用图标（编辑 build/icons/icon.svg 后执行）
npm run icons

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
│   ├── i18n/                       # 国际化（中英双语）
│   │   ├── i18n-store.ts           # Zustand store + useTranslation hook
│   │   ├── zh.json                 # 中文翻译键值对（~200 键）
│   │   └── en.json                 # 英文翻译键值对（~200 键）
│   ├── components/
│   │   ├── CommandPalette/         # 命令面板 (Ctrl+E)
│   │   ├── Editor/                 # 编辑器组件
│   │   ├── Preview/                # 预览组件
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx         # VS Code 风格图标栏容器
│   │   │   ├── FileTreePanel.tsx   # 文件树（含欢迎屏 + 最近文件）
│   │   │   ├── OutlinePanel.tsx    # 大纲
│   │   │   └── SearchPanel.tsx     # 全局搜索
│   │   └── Settings/               # 设置面板
│   ├── engine/                     # 插件引擎
│   ├── services/
│   │   ├── command-registry.ts     # 内置命令 + 模糊搜索 + LRU 最近使用
│   │   ├── workspace-store.ts      # 工作区会话保存/恢复（localStorage）
│   │   ├── theme-service.ts        # 主题管理（12 套主题）
│   │   ├── recent-files.ts         # 最近文件（localStorage）
│   │   └── electron-bridge.ts      # IPC 调用封装
│   ├── stores/                     # Zustand 状态（6 个 Store）
│   └── styles/                     # CSS 样式
│
├── themes/                         # 主题 CSS 变量（12 套）
│   ├── plain-white.css             # 浅色·素白纸
│   ├── warm-sun.css                # 浅色·暖阳
│   ├── cloud.css                   # 浅色·云白
│   ├── mint.css                    # 浅色·薄荷
│   ├── tokyo-night-light.css       # 浅色·东京夜白
│   ├── rose-pine-dawn.css          # 浅色·玫瑰黎明
│   ├── night-black.css             # 深色·暗夜黑
│   ├── deep-sea.css                # 深色·深海
│   ├── warm-gray.css               # 深色·暖灰
│   ├── mo-zhu.css                  # 深色·墨竹
│   ├── tokyo-night.css             # 深色·东京夜
│   └── rose-pine.css               # 深色·玫瑰松
│
├── plugins/                        # 插件目录
│   ├── builtins/doc-templates/     # 文档模板插件
│   ├── builtins/code-runner/       # 代码运行器插件
│   ├── doc-stats/                  # 文档统计（示例）
│   └── writing-aid/                # 写作辅助（示例）
│
├── build/icons/                    # 应用图标
│   ├── icon.svg                    # 矢量源文件（M↓ 设计）
│   ├── png/                        # 多尺寸 PNG（16~1024px）
│   └── win/icon.ico                # Windows 图标
│
├── test/                           # 测试（118 单元/集成 + 14 E2E）
├── docs/                           # 设计文档 & 截图
├── scripts/generate-icons.js       # 图标生成脚本
├── package.json
├── vite.config.mts
└── electron-builder.yml
```

## 开发状态

核心功能已全部实现并稳定。v0.2.0 新增：文档内查找替换、粘贴 URL 自动转链接、粘贴/拖拽图片、自动保存、状态栏增强、表格插入辅助、主题体系扩展至 12 套、插件管理集成到设置面板。v0.3.0 新增：命令面板 (Ctrl+E)、工作区会话恢复、完整中英双语国际化（实时切换）。共 141 单元测试通过，CI/CD 三平台打包就绪。

## 未来展望

- **AI 写作助手**：接入本地或云端 LLM，提供续写、润色、摘要等能力，以插件形式集成，不侵入核心
- **协同编辑**：基于 CRDT（如 Yjs）实现多人实时协作，共享同一文档的编辑状态
- **版本历史**：为每个文件维护本地 Git 式快照，支持对比差异和一键回滚
- **云同步**：可选对接 WebDAV / S3 / iCloud，实现多设备文档同步
- **移动端**：探索 Tauri v2 或 React Native 方案，将编辑体验延伸至 iOS / Android
- **插件市场**：构建插件发布、搜索、一键安装的生态入口
- **自定义主题编辑器**：在设置面板内实时调色、导出主题 CSS，降低主题创作门槛
- **无障碍（a11y）**：ARIA 属性、键盘导航增强、高对比度主题
- **拼写检查**：集成 nspell / hunspell 本地拼写检查

## License

MIT

