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
- **每日笔记**：一键创建今日笔记，按 `日记/YYYY/MM/YYYY-MM-DD.md` 归档，自动填充 frontmatter
- **Rust 知识库引擎**：知识库索引与反链/图谱/标签由单一 Rust 引擎处理，1000+ 文件扫描 < 3s
- **Tantivy 全文搜索**：倒排索引搜索引擎替代线性扫描，大知识库搜索从秒级到毫秒级

### 编辑器
- **格式化工具栏**：撤销/重做、标题、加粗/斜体/删除线、引用/代码块/列表、链接/图片/分割线/公式/表格、专注/打字机模式
- **AI 辅助写作**：选中文本弹出 AI 菜单，支持翻译、摘要、改写、扩展（需安装 Ollama）
- **模板系统**：从模板创建新笔记（日记、周报、会议记录、读书笔记），支持 `{{date}}` 占位符
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
- **虚拟滚动**：文件树和搜索结果支持 10000+ 条目流畅渲染
- **多格式导入**：从 Word (.docx)、PDF、HTML、EPUB 导入并自动转换为 Markdown（pandoc 优先，内置降级方案）
- **快捷工具栏**：新建、打开、新建笔记、切换侧边栏、搜索、导入、导出、主题切换、编辑/预览模式、设置
- **文件树侧边栏**：浏览和打开文件夹内的 Markdown 文件
- **大纲面板**：自动提取标题结构，点击跳转编辑器和预览区
- **全局搜索**：跨文件全文搜索（Tantivy 倒排索引引擎）
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
| `Ctrl+Shift+D` | 创建/打开今日笔记 |
| `F11` | 专注模式 |
| `F12` | 打字机模式 |
| `Ctrl+B` | 加粗 `**text**` |
| `Ctrl+I` | 斜体 `*text*` |
| `Ctrl+K` | 插入链接 |
| `` Ctrl+` `` | 行内代码 |
| `` Ctrl+Shift+` `` | 代码块 |
| `Ctrl+Shift+M` | 公式块 |
| `Ctrl+Shift+L` | 无序列表 |
| `Ctrl+Shift+O` | 有序列表 |
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
| 全文搜索 | Tantivy（Rust 倒排索引） |
| 文本转换 | pandoc + html2text + docx-rs |
| 状态管理 | Zustand |
| 沙箱安全 | DOMPurify |
| DOM 增量 | morphdom |
| 后端 | Rust（文件 I/O、搜索、文件监听、知识库索引） |
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
│       ├── lib.rs                  # Rust 命令（文件I/O/搜索/监听/导入）
│       ├── knowledge/              # 知识库索引引擎（Rust 版）
│       │   ├── types.rs            # 数据结构
│       │   ├── parser.rs           # wikilinks/tags/frontmatter 解析
│       │   ├── indexer.rs          # 全量/增量索引
│       │   └── resolver.rs         # 反链/图谱/标签查询
│       ├── search/                 # Tantivy 全文搜索
│       │   ├── schema.rs           # 索引 Schema
│       │   ├── indexer.rs          # 索引构建
│       │   └── searcher.rs         # BM25 搜索查询
│       └── import.rs               # 多格式导入转换
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
│   │   ├── Settings/               # 设置面板
│   │   ├── TemplatePicker.tsx      # 模板选择对话框
│   │   └── DailyNoteButton.tsx     # 新建笔记按钮
│   ├── services/
│   │   ├── bridge.ts               # Tauri IPC 封装层
│   │   ├── command-registry.ts     # 内置命令 + 模糊搜索
│   │   ├── theme-service.ts        # 主题管理（12 套主题）
│   │   ├── template-service.ts     # 模板系统
│   │   ├── import-service.ts       # 多格式导入服务
│   │   ├── ai-service.ts           # Ollama AI 服务
│   │   └── recent-files.ts         # 最近文件
│   ├── stores/                     # Zustand 状态（6 个 Store）
│   ├── editor/                     # CM6 扩展（ai-tooltip, wikilinks, tags, wysiwyg 等）
│   ├── hooks/                      # 自定义 hooks（虚拟滚动等）
│   └── styles/                     # CSS 样式
│
├── themes/                         # 主题 CSS 变量（12 套）
├── test/                           # 测试
├── docs/                           # 设计文档 & 截图
├── package.json
├── vite.config.mts
└── tsconfig.json
```

## 更新日志

### v0.1.0（未发布）

**架构收敛与死代码清理**：
- **知识引擎单一化**：移除 JS 知识库引擎（`knowledge-service.ts`），统一由 Rust 引擎与 Tantivy 处理索引/反链/图谱/标签；删除双后端切换（localStorage `confucius-knowledge-backend`）。
- **渲染管线单一化**：移除 Rust 版 Markdown 渲染管线（`src-tauri/src/render/`）及其未使用的命令 `render_markdown`，仅保留前端 markdown-it 渲染。
- **死代码清理**：删除从未被调用的 `knowledge_init` 命令、`AIConfigDialog` 组件、`types/file.ts`（`FileResult`）。
- **依赖收敛**：移除未使用的前端插件 `@tauri-apps/plugin-fs`、`@tauri-apps/plugin-process` 及其 Rust 初始化与 capability 授权；移除仅被旧渲染模块使用的 `syntect`/`ammonia`/`pulldown-cmark` crate。

### v1.0.0

**数据安全与稳定性**（v0.8+ 系列修复的整合）：
- **自动保存竞态修复**：写入期间继续输入不再被误标为已保存，内容不会丢失；写入串行化避免乱序覆盖
- **Tantivy 索引去重**：同一文件多次保存不再产生重复索引文档
- **知识索引原子写入**：`index.json` 临时文件 + rename 原子替换，损坏时自动全量重建（不再清空索引）
- **未命名标签另存为**：关闭未命名且已修改的标签时弹出保存对话框，取消则保留标签
- **索引实时同步**：文件变更（watcher）→ 反链/图谱/标签/全文搜索增量更新，不再需要重启应用
- **主题防护**：localStorage 无效主题值自动回退默认主题（修复启动白屏）

**架构收敛**：
- **Rust 知识库引擎为正式后端**（默认），JS 引擎仅作回退；Quick Open 与 wikilink 跳转在 Rust 后端下走 Tantivy
- 消除 JS/Rust 双引擎的解析行为差异（链接解析统一为先写保留语义）

**体验与无障碍**：
- **toast 错误通知**：保存/打开/导入/AI/图片失败均有可见反馈（替代静默 console.error 与 alert）
- **键盘可达性**：文件树方向键导航、标签页 ←→/Delete 操作、命令面板焦点陷阱与 `aria` 语义
- **快捷键单一事实源**：`src/config/shortcuts.ts` 统一管理，修复 Ctrl+Shift+O 冲突（归有序列表）
- 粘贴图片链接路径与设置中的图片目录一致

**工程基建**：
- **GitHub Actions CI**：typecheck / lint / vitest / cargo test 全自动
- **性能**：知识解析正则一次性编译缓存；索引构建消除整表深拷贝
- **测试**：Rust 102 个、前端 207 个用例；修复 JS 知识引擎"假测试"（改为直接测生产代码）

### v0.7.0

**知识库引擎**：
- **Rust 知识库索引**：新增 `src-tauri/src/knowledge/` 模块，wikilinks/tags/frontmatter 解析和增量索引迁移至 Rust，1000+ 文件全量扫描 < 3s
- **Tantivy 全文搜索**：用 Tantivy 倒排索引引擎替换线性 regex 扫描，搜索从秒级降至毫秒级
- **前端双后端**：`knowledge-store.ts` 支持 JS/Rust 双后端切换，通过 localStorage `confucius-knowledge-backend` 控制

**编辑器增强**：
- **AI 辅助写作**：选中文本弹出 AI 菜单，支持翻译、摘要、改写、扩展（需本地运行 Ollama）
- **AI 配置面板**：设置 Ollama 地址、选择模型、一键测试连接
- **模板系统**：`.confucius/templates/` 目录 + 预置 4 套模板（日记/周报/会议记录/读书笔记），支持 `{{date}}`/`{{title}}` 等占位符
- **新建笔记按钮**：DailyNoteButton 重构为通用模板选择器

**文件管理**：
- **多格式导入**：支持从 Word (.docx)、PDF、HTML、EPUB 导入并转换为 Markdown（pandoc 优先，内置 html2text + docx-rs + zip 降级方案）
- **虚拟滚动**：`use-virtual-list` hook，文件树和搜索结果支持 10000+ 条目流畅渲染

**性能**：
- 45 个 Rust 单元测试覆盖 knowledge/search 模块
- 174 个前端测试，类型安全和 lint 零错误

### v0.6.0

图片粘贴管理与架构清理：

- **图片粘贴管理**：Ctrl+V 粘贴截图/图片 → Rust 自动保存到 `assets/` 目录 → 插入 `![](...)`
- **新增 Rust 命令**：`save_image_file` — 接收 base64、解码、写入指定目录
- **新增设置项**：图片保存路径（可配置，默认 `assets`）
- **文件重命名**：`electron-bridge.ts` → `bridge.ts`，消除 Electron 误解
- **死代码清理**：`confirmSave` 移除永不触发的返回值 `2`

## 从 Electron 迁移

v0.5.0 从 Electron 28 迁移至 Tauri 2，主要变化：

- **安装包体积**：~72 MB（Electron NSIS）→ **约 8 MB**（Tauri）
- **内存占用**：~200 MB → **约 60 MB**
- **启动速度**：1-3 秒 → **< 1 秒**
- **后端语言**：Node.js → **Rust**
- **原生菜单**：移除，使用 Web 工具栏替代
- **PDF 导出**：Electron printToPDF → 系统打印对话框
- **插件系统**：移除（引擎 + 外部插件）
- **编码检测**：jschardet + iconv-lite → Rust 直接读取 UTF-8
- **图片路径**：`convertFileSrc` + asset 协议 → Rust base64 data URI

## 开发状态

v1.0.0 在 v0.7.0 的功能基础上完成稳定性加固（数据安全、索引可靠性、实时同步）、Rust 引擎正式化、无障碍与反馈体系完善，并落地 CI 与性能优化，达到 1.0 发布标准。当前主线上已完成架构收敛（移除 JS 知识引擎与 Rust 渲染管线、清理死代码与冗余插件），知识库以 Rust 引擎为唯一后端。

## License

MIT
