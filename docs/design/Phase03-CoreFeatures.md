# 第三阶段详细设计：核心功能完善与体验优化

**计划周期**：第 6-10 周  
**阶段目标**：全面支持 GFM Markdown 语法渲染（代码高亮、数学公式、表格），实现文件树侧边栏、全局搜索、快捷键系统。

---

## 1. 模块总览

```
Phase 3 功能矩阵
┌─────────────────────────────────────────────────────┐
│                  渲染进程 (React)                       │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ 侧边栏    │  │ 编辑器    │  │ 预览区             │  │
│  │ ┌──────┐ │  │ (CM6)   │  │ ┌────────────────┐ │  │
│  │ │文件树 │ │  │         │  │ │ markdown-it    │ │  │
│  │ ├──────┤ │  │ Markdown│  │ │ + highlight.js │ │  │
│  │ │大纲   │ │  │ 语法高亮 │  │ │ + KaTeX        │ │  │
│  │ │(标题) │ │  │         │  │ │ + 表格渲染     │ │  │
│  │ └──────┘ │  │         │  │ └────────────────┘ │  │
│  └──────────┘  └──────────┘  └────────────────────┘  │
│                                                       │
│  ┌──────────────────────────────────────────────┐     │
│  │ 快捷键系统 (keymap 注册 + UI 提示)             │     │
│  └──────────────────────────────────────────────┘     │
│                                                       │
│  ┌──────────────────────────────────────────────┐     │
│  │ 全局搜索 (侧边栏搜索面板)                      │     │
│  └──────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
         │ IPC
         ▼
┌─────────────────────────────────────────────────────┐
│                   主进程 (Node.js)                     │
│  ┌──────────────┐  ┌──────────────┐                  │
│  │ FileService  │  │ SearchService│                  │
│  │ (扩展)       │  │ (遍历搜索)   │                  │
│  └──────────────┘  └──────────────┘                  │
└─────────────────────────────────────────────────────┘
```

---

## 2. 预览区渲染增强

### 2.1 渲染管线升级

```
编辑器文本
     │
     ▼
markdown-it 解析
     │
     ├── markdown-it (核心) ───────────────── GFM 语法
     ├── highlight.js ─────────────────────── 代码块高亮
     ├── markdown-it-texmath ──────────────── KaTeX 公式
     ├── markdown-it-table + 自定义样式 ───── 表格渲染
     ├── markdown-it-task-lists ───────────── 任务列表
     └── markdown-it-footnote ─────────────── 脚注
     │
     ▼
HTML 字符串 → 注入预览区
     │
     ▼
KaTeX.renderMathInElement() ─── DOM 级后处理渲染公式
```

### 2.2 代码高亮 (highlight.js)

```typescript
// src/editor/markdown-renderer.ts（升级版）
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css'; // 亮色主题
// 暗色主题动态切换

const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  highlight: (str: string, lang: string): string => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(str, {
          language: lang,
          ignoreIllegals: true,
        });
        return `<pre class="code-block"><code class="hljs language-${lang}">${highlighted.value}</code></pre>`;
      } catch {
        // fallthrough
      }
    }
    // 无语言或高亮失败时，启用自动检测
    const autoDetected = hljs.highlightAuto(str);
    return `<pre class="code-block"><code class="hljs">${autoDetected.value}</code></pre>`;
  },
});
```

**代码块增强**：
- 自动检测语言（无 ` ``` ` 标记时）
- 在 `<pre>` 上方添加语言标签栏，显示语言名称
- 可选：添加"复制代码"按钮
- 行号显示（使用 CSS counter 实现）

```css
/* 代码块样式 */
.code-block {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
  margin: 1em 0;
}
.code-block .lang-label {
  position: absolute;
  top: 0;
  right: 12px;
  font-size: 12px;
  color: var(--code-lang-color, #888);
  padding: 4px 8px;
}
```

### 2.3 数学公式 (KaTeX)

```typescript
// src/editor/katex-plugin.ts
import katex from 'katex';
import 'katex/dist/katex.min.css';

// markdown-it 插件：将 $$...$$ 和 $...$ 转换为 KaTeX HTML
export function katexPlugin(md: MarkdownIt): void {
  // 自定义分隔符处理
  // 行内公式：$...$
  // 块级公式：$$...$$
  md.inline.ruler.after('escape', 'katex_inline', (state, silent) => {
    // ... 解析 $ 分隔符，调用 katex.renderToString()
  });

  md.block.ruler.after('code', 'katex_block', (state, startLine, endLine, silent) => {
    // ... 解析 $$ 块级公式
  });
}
```

**或使用现成插件**（推荐 `markdown-it-texmath`）：

```typescript
import texmath from 'markdown-it-texmath';

md.use(texmath, {
  engine: katex,
  delimiters: 'dollars',
  katexOptions: { macros: {/* 自定义宏定义 */} },
});
```

**渲染后处理**：markdown-it 渲染完成后，对 DOM 中的公式元素调用 KaTeX：

```typescript
// markdown-it 无法完全处理 KaTeX 的所有特性（如 \label, \tag）
// 需要 DOM 级后处理
useEffect(() => {
  if (previewRef.current) {
    renderMathInElement(previewRef.current, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
      ],
      throwOnError: false,
    });
  }
}, [html]);
```

### 2.4 表格渲染

GFM 表格通过 markdown-it 原生支持，需要补充 CSS 样式：

```css
/* 表格样式 */
.preview-pane table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  overflow-x: auto;
  display: block;
}
.preview-pane th,
.preview-pane td {
  border: 1px solid var(--table-border, #dfe2e5);
  padding: 8px 12px;
  text-align: left;
}
.preview-pane th {
  background: var(--table-header-bg, #f6f8fa);
  font-weight: 600;
}
.preview-pane tr:nth-child(even) {
  background: var(--table-row-alt, #f6f8fa);
}
```

---

## 3. 侧边栏设计

### 3.1 侧边栏整体架构

```
Sidebar (根容器)
├── TabBar (选项卡切换)
│   ├── 📁 文件树  ← 默认激活
│   └── 📋 大纲
│   └── 🔍 搜索（第三阶段新增）
│
├── FileTreePanel (文件树面板)
│   ├── DirectoryNode (目录节点)
│   │   └── FileNode | DirectoryNode (递归)
│   └── ContextMenu (右键菜单)
│       ├── 新建文件
│       ├── 新建目录
│       ├── 重命名
│       ├── 删除
│       └── 在资源管理器中显示
│
├── OutlinePanel (大纲面板)
│   └── OutlineItem (标题项，递归)
│       └── H1 ~ H6 级别
│
└── SearchPanel (搜索面板)
    ├── SearchInput (搜索框)
    ├── SearchOptions (选项：大小写/正则)
    ├── SearchResultsList (结果列表)
    └── MatchCount (匹配计数)
```

### 3.2 文件树组件

#### 数据结构

```typescript
// src/types/file-tree.ts
interface FileTreeNode {
  name: string;
  path: string;          // 绝对路径
  type: 'file' | 'directory';
  children?: FileTreeNode[];  // 仅目录有
  isExpanded?: boolean;       // 目录展开状态
  isSelected?: boolean;       // 选中状态
}

// 扁平化的排序规则
// 1. 目录优先
// 2. 按名称字母序
```

#### 文件树构建

```typescript
// src/services/file-tree-builder.ts
import fs from 'fs';
import path from 'path';

export function buildFileTree(rootPath: string): FileTreeNode {
  const stats = fs.statSync(rootPath);
  const name = path.basename(rootPath);
  const node: FileTreeNode = {
    name,
    path: rootPath,
    type: stats.isDirectory() ? 'directory' : 'file',
  };

  if (stats.isDirectory()) {
    const entries = fs.readdirSync(rootPath);
    const children = entries
      .filter(entry => !entry.startsWith('.')) // 排除隐藏文件
      .map(entry => buildFileTree(path.join(rootPath, entry)))
      .sort((a, b) => {
        // 目录优先，名称排序
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    node.children = children;
  }

  return node;
}
```

#### 虚拟滚动优化

文件树如果包含大量文件，需要虚拟滚动（使用 `react-window` 或 `react-virtuoso`）：

```tsx
// 使用扁平化列表展示
interface FlatItem {
  depth: number;
  node: FileTreeNode;
  isExpandable: boolean;
}

function flattenTree(node: FileTreeNode, depth: number = 0): FlatItem[] {
  const items: FlatItem[] = [{
    depth,
    node,
    isExpandable: node.type === 'directory',
  }];
  if (node.type === 'directory' && node.isExpanded && node.children) {
    for (const child of node.children) {
      items.push(...flattenTree(child, depth + 1));
    }
  }
  return items;
}
```

#### 右键菜单

使用 Electron 原生菜单或自定义上下文菜单：

```typescript
// electron/ipc-handlers.ts
ipcMain.handle('sidebar:context-menu', async (event, { nodePath, nodeType }) => {
  const menu = Menu.buildFromTemplate([
    { label: '新建文件', click: () => event.sender.send('sidebar:action', { action: 'new-file', path: nodePath }) },
    { label: '新建目录', click: () => event.sender.send('sidebar:action', { action: 'new-dir', path: nodePath }) },
    { type: 'separator' },
    { label: '重命名', click: () => event.sender.send('sidebar:action', { action: 'rename', path: nodePath }) },
    { label: '删除', click: () => event.sender.send('sidebar:action', { action: 'delete', path: nodePath }) },
  ]);
  menu.popup({ window: BrowserWindow.fromWebContents(event.sender)! });
});
```

#### 文件变更监听

使用 `fs.watch` 或 `chokidar` 监听文件夹变更，自动更新文件树：

```typescript
// electron/services/file-watcher.ts
import chokidar from 'chokidar';

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;

  watch(rootPath: string, onChanged: () => void) {
    this.watcher = chokidar.watch(rootPath, {
      ignored: /(^|[/\\])\./,  // 忽略隐藏文件
      persistent: true,
    });
    this.watcher.on('all', () => onChanged());
  }

  unwatch() {
    this.watcher?.close();
    this.watcher = null;
  }
}
```

> **注意**：`onChanged` 需要防抖（500ms），避免频繁重建文件树导致 UI 卡顿。

### 3.3 大纲面板

#### 大纲数据提取

从 CM6 编辑器的语法树中提取标题节点：

```typescript
// src/editor/outline-parser.ts
import { syntaxTree } from '@codemirror/language';

interface OutlineItem {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  from: number;  // CM6 文档位置 (用于点击跳转)
  to: number;
}

export function extractOutline(doc: string): OutlineItem[] {
  // 方式一：直接从 markdown-it 解析 AST
  // 方式二：正则快速提取（更适合实时更新）
  const lines = doc.split('\n');
  const items: OutlineItem[] = [];

  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      items.push({
        level,
        text: match[2].trim(),
        from: lines.slice(0, index).join('\n').length,
        to: from + line.length,
      });
    }
  });

  return items;
}
```

#### 点击跳转

点击大纲项时，滚动编辑器到对应位置：

```typescript
// 通过 CM6 的 EditorView.dispatch 执行滚动
function jumpToPosition(pos: number) {
  viewRef.current?.dispatch({
    effects: EditorView.scrollIntoView(pos, { y: 'start' }),
    selection: { anchor: pos },
  });
}
```

### 3.4 侧边栏状态管理

```typescript
// src/stores/sidebar-store.ts
interface SidebarStore {
  activeTab: 'file-tree' | 'outline' | 'search';
  fileTree: FileTreeNode | null;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  searchQuery: string;
  searchResults: SearchResult[];

  setActiveTab: (tab: string) => void;
  setFileTree: (tree: FileTreeNode) => void;
  toggleExpand: (path: string) => void;
  selectFile: (path: string) => void;
  setSearchQuery: (q: string) => void;
}
```

---

## 4. 全局搜索

### 4.1 搜索架构

```
┌──────────────────────────────┐
│  搜索面板 (渲染进程)           │
│  ┌────────────────────────┐  │
│  │ 搜索输入 (防抖 300ms)   │  │
│  ├────────────────────────┤  │
│  │ 搜索结果列表            │  │
│  │  ├ 文件A:匹配行1       │  │
│  │  ├ 文件A:匹配行2       │  │
│  │  └ 文件B:匹配行1       │  │
│  └────────────────────────┘  │
└──────────┬───────────────────┘
           │ IPC 'search:query'
           ▼
┌──────────────────────────────┐
│  SearchService (主进程)       │
│                              │
│  1. 遍历文件夹所有 .md 文件    │
│  2. 对每个文件逐行匹配         │
│  3. 返回匹配结果              │
└──────────────────────────────┘
```

### 4.2 SearchService（主进程）

```typescript
// electron/services/search-service.ts
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';  // 或自建递归遍历

interface SearchResult {
  filePath: string;
  fileName: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

export class SearchService {
  async search(rootPath: string, query: string, options?: {
    caseSensitive?: boolean;
    regex?: boolean;
    maxResults?: number;
  }): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const files = await glob('**/*.md', { cwd: rootPath, absolute: true });
    const maxResults = options?.maxResults ?? 500;
    const flags = options?.caseSensitive ? 'g' : 'gi';
    const pattern = options?.regex ? new RegExp(query, flags) : new RegExp(escapeRegex(query), flags);

    for (const filePath of files) {
      if (results.length >= maxResults) break;
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match: RegExpExecArray | null;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(line)) !== null && results.length < maxResults) {
          results.push({
            filePath,
            fileName: path.basename(filePath),
            lineNumber: i + 1,
            lineContent: line,
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
          });
        }
      }
    }

    return results;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### 4.3 搜索结果交互

- 点击搜索结果 → 打开对应文件并滚动到匹配行
- 键盘上下键导航搜索结果
- 搜索高亮：`lineContent` 中匹配部分使用 `<mark>` 标签包裹
- 支持快捷键 `Ctrl+Shift+F` 聚焦搜索面板

---

## 5. 快捷键系统

### 5.1 快捷键注册架构

```
快捷键定义 (keybindings.ts)
       │
       ├── 全局快捷键 (Electron globalShortcut)
       │   → 通过主进程注册
       │   → 示例: Ctrl+Shift+F (搜索)
       │
       ├── 编辑器快捷键 (CM6 keymap)
       │   → 通过 CM6 extensions 注册
       │   → 示例: Ctrl+B (加粗), Ctrl+I (斜体)
       │
       └── 应用快捷键 (React 层 keydown 事件)
           → 在 App 根组件监听
           → 示例: Ctrl+N (新建), Ctrl+S (保存)
```

### 5.2 CM6 编辑器快捷键

```typescript
// src/editor/keybindings.ts
import { keymap } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';

// 加粗：选中文本包裹 **
const boldKeyBinding = {
  key: 'Mod-b',
  run: (view: EditorView): boolean => {
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    view.dispatch({
      changes: { from, to, insert: `**${selected}**` },
      selection: { anchor: from + 2, head: from + 2 + selected.length },
    });
    return true;
  },
};

// 斜体
const italicKeyBinding = {
  key: 'Mod-i',
  run: (view: EditorView): boolean => {
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    view.dispatch({
      changes: { from, to, insert: `*${selected}*` },
      selection: { anchor: from + 1, head: from + 1 + selected.length },
    });
    return true;
  },
};

// 快捷键注册
export const editorKeyBindings = keymap.of([
  boldKeyBinding,
  italicKeyBinding,
  { key: 'Mod-k', run: insertLink },       // 插入链接
  { key: 'Mod-`', run: insertCode },        // 行内代码
  { key: 'Mod-Shift-`', run: insertCodeBlock }, // 代码块
  { key: 'Mod-Shift-m', run: insertMath },  // 公式块
]);
```

### 5.3 常用快捷键清单

| 快捷键 | 功能 | 注册层级 | 状态 |
|--------|------|---------|------|
| `Ctrl+Shift+F` | 全局搜索 | 全局 | ✅ |
| `Ctrl+B` | 加粗 | CM6 | ✅ |
| `Ctrl+I` | 斜体 | CM6 | ✅ |
| `Ctrl+K` | 插入链接 | CM6 | ✅ |
| `Ctrl+`` ` | 行内代码 | CM6 | ✅ |
| `Ctrl+Shift+`` ` | 代码块 | CM6 | ✅ |
| `Ctrl+Shift+M` | 公式块 | CM6 | ✅ |
| `Ctrl+Shift+L` | 插入无序列表 | CM6 | ✅ |
| `Ctrl+Shift+[` | 插入引用 | CM6 | ✅ |
| `Ctrl+Shift+O` | 插入有序列表 | CM6 | ✅ |
| `F11` | 切换专注模式 | 全局 | 第五阶段 |

### 5.4 快捷键显示提示

在菜单项和工具提示中显示快捷键标注，参考 VSCode 的 `Cmd+...` 格式：

```typescript
function formatShortcut(key: string): string {
  // 'Mod-b' → 'Ctrl+B' (Windows) / '⌘B' (macOS)
  const isMac = process.platform === 'darwin';
  const mod = isMac ? '⌘' : 'Ctrl+';
  return key.replace('Mod', isMac ? '' : 'Ctrl')
            .replace('Shift', 'Shift+')
            .replace(/^./, c => c.toUpperCase());
}
```

---

## 6. 组件与文件变更

### 6.1 新建文件

| 文件路径 | 说明 |
|---------|------|
| `src/components/Editor/EditorPane.tsx` | 编辑器组件增强 |
| `src/components/Preview/PreviewPane.tsx` | 预览区组件 |
| `src/components/Sidebar/Sidebar.tsx` | 侧边栏容器 |
| `src/components/Sidebar/FileTreePanel.tsx` | 文件树面板 |
| `src/components/Sidebar/OutlinePanel.tsx` | 大纲面板 |
| `src/components/Sidebar/SearchPanel.tsx` | 搜索面板 |
| `src/components/Sidebar/ContextMenu.tsx` | 右键菜单 |
| `src/editor/markdown-renderer.ts` | markdown-it 配置升级 |
| `src/editor/katex-plugin.ts` | KaTeX 插件 |
| `src/editor/keybindings.ts` | 编辑器快捷键 |
| `src/services/file-tree-builder.ts` | 文件树构建 |
| `src/services/outline-parser.ts` | 大纲解析 |
| `electron/services/search-service.ts` | 全搜服务 |
| `electron/services/file-watcher.ts` | 文件监听 |
| `src/stores/sidebar-store.ts` | 侧边栏状态 |

---

## 7. 验收标准

| 功能 | 验收条件 |
|------|---------|
| 代码高亮 | 预览区代码块有语法高亮，支持 64+ 语言 |
| 数学公式 | `$...$` 行内公式和 `$$...$$` 块级公式正确渲染为 LaTeX 效果 |
| 表格渲染 | GFM 格式表格正确显示，带交替行背景色 |
| 文件树 | 侧边栏显示当前文件夹的树形结构，可展开/折叠 |
| 文件树右键 | 右键菜单可新建文件/目录、重命名、删除 |
| 文件变更同步 | 在外部修改文件后，文件树自动更新 |
| 大纲 | 根据文档标题自动生成大纲，点击可跳转编辑位置 |
| 全局搜索 | 输入关键词后搜索整个文件夹的 .md 文件，结果高亮 |
| 搜索结果跳转 | 点击搜索结果打开对应文件并定位到匹配行 |
| 快捷键 | Ctrl+B/I/K 等快捷键正确插入 Markdown 语法 |
| 文件操作 | 侧边栏文件树中点击文件可打开编辑 |

---

## 8. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| KaTeX 与 markdown-it 集成问题 | 公式渲染异常 | 使用成熟的 `markdown-it-texmath` 库 |
| 大文件夹文件树渲染性能 | 侧边栏卡顿 | 虚拟滚动、延迟加载子目录 |
| 全局搜索大量文件耗时 | 搜索响应慢 | 防抖输入（300ms）、限制最大结果数（500）、可取消上次搜索 |
| 外部文件变更冲突 | 内容丢失风险 | 监听变更后弹窗提示用户选择"重新加载"或"忽略" |
