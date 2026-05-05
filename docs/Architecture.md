# 技术架构概览

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 桌面框架 | Electron ^28 | 主进程 + 渲染进程双进程架构 |
| 前端 | React 18 + TypeScript | 组件化 UI |
| 构建 | Vite 5 + vite-plugin-electron | HMR + 主进程热重启 |
| 编辑器 | CodeMirror 6 | Markdown 编辑内核 |
| Markdown 渲染 | markdown-it + 插件 | GFM、Task List、KaTeX |
| 代码高亮 | highlight.js | — |
| 数学公式 | KaTeX | 行内 + 块级 |
| 图表 | Mermaid | 流程图、时序图等 |
| 状态管理 | Zustand | 5 个 Store |
| 安全防护 | DOMPurify | XSS 过滤 |
| DOM 更新 | morphdom | 预览区增量更新 |
| 编码检测 | jschardet + iconv-lite | UTF-8/GBK/Big5 等 |
| 测试 | Vitest + React Testing Library | 121 测试通过 |
| 打包 | electron-builder | Windows/macOS/Linux |

## 进程架构

```
Electron 主进程 (electron/)
├── main.ts               # 窗口管理、生命周期
├── menu.ts              # 原生菜单
├── ipc-handlers.ts      # IPC 路由
├── preload.ts           # 上下文桥接
└── services/
    ├── file-service.ts    # 文件读写、文件树
    ├── file-watcher.ts    # fs.watch 监听
    ├── search-service.ts  # 全文搜索
    ├── export-service.ts  # HTML/PDF 导出
    ├── encoding-detector.ts # 编码检测
    └── scanner-service.ts # 插件目录扫描

渲染进程 (src/)
├── App.tsx               # 根组件、菜单 IPC 处理
├── main.tsx              # 入口 + 主题 CSS 加载
├── components/
│   ├── Editor/           # 编辑器布局/面板/工具栏/标签栏/状态栏
│   ├── Preview/          # Markdown 预览
│   ├── Sidebar/          # 文件树/大纲/搜索
│   └── Settings/         # 主题选择器/插件管理对话框
├── editor/
│   ├── cm6-setup.ts      # CM6 初始化
│   ├── keybindings.ts    # 编辑器快捷键
│   ├── format-helpers.ts # 格式化函数（工具栏+快捷键共用）
│   ├── markdown-renderer.ts # markdown-it 配置
│   ├── mermaid-renderer.ts  # Mermaid 渲染
│   ├── wysiwyg-plugin.ts    # WYSIWYG 模式
│   ├── focus-mode.ts        # 专注模式
│   ├── typewriter-mode.ts   # 打字机模式
│   ├── sync-scroll.ts       # 滚动同步
│   ├── outline-parser.ts    # 大纲提取
│   ├── active-view.ts       # 模块级 EditorView 引用
│   └── large-file-handler.ts # 大文件检测
├── stores/               # Zustand 状态管理
│   ├── app-store.ts
│   ├── editor-store.ts
│   ├── sidebar-store.ts
│   ├── tab-store.ts
│   └── plugin-store.ts
├── engine/               # 插件引擎（部分实现）
│   ├── PluginEngine.ts
│   ├── HostAPIBridge.ts
│   ├── DependencyGraph.ts
│   ├── EventBus.ts
│   ├── ConfigDB.ts
│   └── SandboxFactory.ts
├── services/
│   ├── electron-bridge.ts    # IPC 封装层
│   ├── theme-service.ts      # 主题切换
│   └── plugin-manager.ts     # 插件管理器（简化版）
└── utils/
    ├── sanitize.ts       # DOMPurify
    ├── dom-diff.ts       # morphdom 增量更新
    └── path.ts           # 路径工具
```

## 关键数据流

### 文件打开

```
文件树/搜索结果点击
  → electron-bridge.readFile()
  → IPC file:read → FileService → fs.readFile
  → tab-store.openFile(filePath, content)
  → editor-store.setContent()
  → EditorPane dispatch 到 CM6
  → PreviewPane 渲染 markdown-it → SVG/HTML
```

### 编辑 → 预览

```
CM6 updateListener (150ms 防抖)
  → format-helpers → dispatch changes
  → editor-store.setContent()
  → PreviewPane useMemo → renderMarkdown()
  → morphdom 增量更新
  → renderMermaidDiagrams()
  → renderMathInElement()
```

### 模式切换

```
菜单 Ctrl+Shift+P / ModeSwitch 按钮
  → editor-store.toggleMode()
  → EditorLayout 根据 mode 渲染 split/wysiwyg
  → key={activeTabId} 触发 CM6 重建
```

## IPC 通道命名

| 通道 | 方向 | 说明 |
|------|------|------|
| `app:get-version` | R→M | 获取版本 |
| `dialog:open-file` | R→M | 打开文件对话框 |
| `dialog:save-file` | R→M | 保存文件对话框 |
| `dialog:open-folder` | R→M | 打开文件夹对话框 |
| `dialog:open-plugin` | R→M | 加载插件对话框 |
| `file:read/write` | R→M | 文件读写 |
| `file:confirm-save` | R→M | 保存确认对话框 |
| `file-tree:build` | R→M | 构建文件树 |
| `file-watcher:start/stop` | R→M | 文件变更监听 |
| `sidebar:context-menu` | R→M | 右键菜单 |
| `sidebar:action` | M→R | 侧边栏操作 |
| `search:query` | R→M | 全局搜索 |
| `export:html/pdf` | R→M | 导出 |
| `scanner:scan` | R→M | 插件目录扫描 |
| `menu:action` | M→R | 菜单操作（统一） |
