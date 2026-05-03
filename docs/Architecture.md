### 🏗️ 技术架构设计方案

#### 1. 技术栈选型

| 层级 | 技术选型 | 原因与说明 |
| :--- | :--- | :--- |
| **桌面端框架** | **Electron** | 主流选择（Typora、VSCode均基于此），使用Web前端技术，社区成熟生态完善。 |
| **前端框架** | **React / TypeScript** | TypeScript + React。 |
| **编辑器内核** | **CodeMirror 6** | **深度定制首选**。ProseMirror 架构强大，能精确控制文档模型；CodeMirror 6 性能卓越。Typora 类编辑器多选其一。 |
| **Markdown 解析** | **markdown-it** | 高性能且通过插件生态支持 GFM、表格等扩展语法，Typora 类编辑器广泛使用。 |
| **代码高亮** | **highlight.js** | 通用选择。 |
| **数学公式** | **KaTeX** | 渲染速度快，被许多在线和桌面编辑器采用。 |
| **图表支持** | **Mermaid** | 事实标准。 |
| **构建工具** | **Vite** | Vite 更快，Webpack 更传统。 |
| **本地存储** | **Node.js `fs` 模块 + SQLite (可选)** | 直接用 Node.js 读写 `.md` 文件。若需全文搜索等功能，可引入 SQLite 建立索引。 |
| **跨平台打包** | **electron-builder** | 将应用打包成 `.exe`、`.dmg` 或 `.deb` 等安装包。 |

#### 2. 系统架构设计

项目可遵循清晰的 Electron 分层架构：

*   **主进程 (Main Process)**：
    *   **窗口管理**：创建和控制应用主窗口。
    *   **生命周期管理**：处理应用启动、退出等。
    *   **原生菜单**：创建和管理应用的原生菜单栏。
    *   **IPC 通信**：作为主从进程间的通信桥梁。

*   **渲染进程 (Renderer Process)**：
    *   **编辑器界面**：由 React 等框架构建所有UI，负责与用户交互。
    *   **编辑器核心实例**：如 CodeMirror 6 的实例，是编辑器的"大脑"。
    *   **业务逻辑**：实现快捷键、主题切换、导出等功能逻辑。
    *   **渲染器**：Markdown 解析、代码高亮、公式渲染等服务。
    *   **格式化工具栏**：位于编辑器顶部，通过模块级引用访问 CM6 EditorView 实例，

*   **本地文件系统 (File System)**：
    *   监听用户本地的 `.md` 文件变化，并提供打开、保存、重命名等文件操作能力。

一个清晰的分层是实现复杂功能的基础，接下来是关于如何实现"即时渲染"的核心设计。

#### 3. 渲染进程组件架构（更新）

```
App.tsx
├── TitleBar (自定义标题栏)
├── Sidebar (打开状态时显示)
│   ├── FileTreePanel
│   ├── OutlinePanel
│   └── SearchPanel
├── FormatToolbar (新增：编辑器顶部工具栏)
│   ├── HeadingGroup (H1 / H2 / H3)
│   ├── InlineGroup (B / I / S)
│   ├── BlockGroup (引用 / 代码块 / 列表)
│   └── InsertGroup (链接 / 图片)
├── EditorLayout
│   ├── EditorPane (CM6 编辑器)
│   └── PreviewPane (Markdown 预览 — 仅 split 模式)
└── ModeSwitch (右下角模式切换)
```

**关键数据流**：

```
FormatToolbar 点击按钮
       │
       ▼
读取 activeEditorView（模块级引用）
       │
       ▼
调用 formatHelpers.ts 中的对应函数
  - 函数接收 view + 选区的 from/to
  - dispatch changes 到 CM6
       │
       ▼
CM6 更新文档 → updateListener → onChange → editorStore.setContent()
```

#### 4. 核心设计：实现"即时渲染"

Typora 的核心体验是即时渲染。一个关键的设计模式是**混淆源码文本与渲染节点**：
*   **数据结构**：不丢弃语法符号。解析后，`**粗体**` 在文档树中并非一个单一的"加粗"节点，而是一个序列节点，如 `"**"` (标记为语法符号) -> `"粗体"` (标记为加粗) -> `"**"` (标记为语法符号)。
*   **显示逻辑**：通过 Decoration 插件，根据节点的类型和属性，决定在编辑器视图中显示还是隐藏某些标记。这样，光标移动时，可以智地能切换显示状态，实现"光标移入显示源码，移出显示效果"。

这个设计很精妙，但对初学者可能很复杂。一个更稳妥的方案是先实现 **"编辑区"+"预览区"双栏模式**（类似许多在线编辑器），等核心文件管理功能稳定后，再加入即时渲染功能进行迭代。这是更稳健的路径。
