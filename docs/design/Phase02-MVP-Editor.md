# 第二阶段详细设计：编辑器核心与本地文件管理 (MVP)

**计划周期**：第 3-5 周  
**阶段目标**：集成 CodeMirror 6 编辑器内核，实现 Markdown 双栏预览、文件新建/打开/保存/另存为功能，搭建基础菜单与文件操作入口。

---

## 1. 模块总览

```
┌─────────────┐     IPC     ┌──────────────┐     fs     ┌────────┐
│  Renderer   │ ←────────→ │  Main Process │ ←────────→ │  Disk  │
│  (React)    │             │  (Node.js)    │            │ .md   │
│             │             │               │            │ files │
│  Editor     │             │  FileService  │            │        │
│  Preview    │             │  IpcHandlers  │            └────────┘
│  FileOpsUI  │             └──────────────┘
└──────┬──────┘
       │ Codemirror 6 + markdown-it
       └──────────────────┐
                   ┌──────┴──────┐
                   │  View Layer │
                   │  Split Pane │
                   └─────────────┘
```

---

## 2. 编辑器核心设计 (CodeMirror 6)

### 2.1 为什么选 CodeMirror 6 而非 ProseMirror

| 对比项 | CodeMirror 6 | ProseMirror |
|--------|-------------|-------------|
| 核心模型 | 文本流 + Decoration | 结构化文档树 |
| Markdown 原生支持 | 优秀（编辑源码天然适合） | 需要额外转换 |
| 性能 | 优（增量解析） | 优（事务模型） |
| 双栏预览模式 | 天然适配 | 适配成本高 |
| 即时渲染 | 需定制 | 天生优势 |

**决策**：MVP 阶段采用双栏模式，CM6 更合适。后续即时渲染可考虑在 CM6 基础上叠加 Decoration，或切换到 PM。

### 2.2 CodeMirror 6 基础配置

```typescript
// src/editor/cm6-setup.ts
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';

export function createEditorView(
  container: HTMLElement,
  onChange: (content: string) => void
): EditorView {
  let updateTimeout: number | null = null;

  const view = new EditorView({
    doc: '',
    extensions: [
      basicSetup,                          // 基础编辑能力
      markdown({                           // Markdown 语言支持
        base: markdownLanguage,
        codeLanguages: [],                 // 后续由 highlight.js 补充
      }),
      syntaxHighlighting(defaultHighlightStyle),
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          // 防抖：减少高频触发
          if (updateTimeout) clearTimeout(updateTimeout);
          updateTimeout = setTimeout(() => {
            onChange(update.state.doc.toString());
          }, 150);
        }
      }),
      keymap.of([...defaultKeymap, ...historyKeymap]),
    ],
    parent: container,
  });

  return view;
}
```

### 2.3 编辑器组件封装

```tsx
// src/components/Editor/EditorPane.tsx
interface EditorPaneProps {
  initialContent?: string;
  onContentChange: (markdown: string) => void;
}

function EditorPane({ initialContent = '', onContentChange }: EditorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const view = createEditorView(containerRef.current, onContentChange);
    viewRef.current = view;
    return () => view.destroy();
  }, []);

  // 支持外部设置内容（如打开文件时）
  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      changes: { from: 0, to: viewRef.current.state.doc.length, insert: initialContent },
    });
  }, [initialContent]);

  return <div ref={containerRef} className="editor-pane" />;
}
```

### 2.4 编辑器状态

```typescript
// src/stores/editor-store.ts
interface EditorStore {
  content: string;
  isLoading: boolean;
  setContent: (content: string) => void;
  setIsLoading: (loading: boolean) => void;
}
```

---

## 3. Markdown 预览模块

### 3.1 渲染管线

```
编辑器文本 (CM6 state.doc)
       │
       ▼
  markdown-it 解析
       │
       ├── markdown-it-sub / sup           ← 上下标扩展
       ├── markdown-it-footnote            ← 脚注扩展
       ├── markdown-it-task-lists          ← GFM 任务列表
       └── (后续阶段叠加高亮/公式/图表)
       │
       ▼
  HTML 字符串
       │
       ▼
  dangerouslySetInnerHTML 渲染到预览区
       │
       ▼
  KaTeX / Mermaid 后处理（第三阶段实现）
```

### 3.2 markdown-it 配置

```typescript
// src/editor/markdown-renderer.ts
import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';

const md = new MarkdownIt({
  html: true,           // 允许内嵌 HTML
  breaks: true,         // 回车即换行（Typora 行为）
  linkify: true,        // 自动识别链接
  typographer: true,    // 智能排版替换
});

md.use(taskLists, { enabled: true, label: true, labelAfter: true });

export function renderMarkdown(text: string): string {
  return md.render(text);
}
```

> **注意**：`breaks: true` 是 Typora 类编辑器的关键配置，使每行回车在预览中显示为 `<br>`，而非需要双回车才换行。

### 3.3 预览区组件

```tsx
// src/components/Preview/PreviewPane.tsx
interface PreviewPaneProps {
  content: string;
}

function PreviewPane({ content }: PreviewPaneProps) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return (
    <div
      className="preview-pane markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

`markdown-body` 样式类使用 GitHub 风格的 Markdown 样式，可参考 `github-markdown-css`。

### 3.4 双栏布局

使用 Flexible Split Pane 方案：

```tsx
// src/components/Editor/EditorLayout.tsx
function EditorLayout() {
  const content = useEditorStore(s => s.content);
  const setContent = useEditorStore(s => s.setContent);

  return (
    <div className="split-pane">
      <ResizablePane defaultWidth="50%" minWidth="200px">
        <EditorPane onContentChange={setContent} />
      </ResizablePane>
      <div className="split-divider" />
      <ResizablePane defaultWidth="50%" minWidth="200px">
        <PreviewPane content={content} />
      </ResizablePane>
    </div>
  );
}
```

---

## 4. 文件系统模块

### 4.1 FileService（主进程）

```typescript
// electron/services/file-service.ts
import fs from 'fs/promises';
import path from 'path';

export class FileService {
  // 读取文件，返回 { content, path }
  async open(filePath: string): Promise<{ content: string; filePath: string }> {
    const resolvedPath = path.resolve(filePath);
    const content = await fs.readFile(resolvedPath, 'utf-8');
    return { content, filePath: resolvedPath };
  }

  // 保存文件（覆盖写入）
  async save(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf-8');
  }

  // 新建文件：显示保存对话框后创建
  async create(defaultName: string): Promise<string | null> {
    // 调用 dialog.showSaveDialog，返回用户选择的路径
    // 写入空内容
  }

  // 检测文件是否存在
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
```

### 4.2 IPC 通道定义

| 通道名 | 方向 | 参数 | 返回值 | 说明 |
|--------|------|------|--------|------|
| `file:open` | R→M→R | `filePath: string` | `{ content, filePath }` | 打开文件 |
| `file:save` | R→M | `{ filePath, content }` | `void` | 保存文件 |
| `file:save-as` | R→M→R | `content: string` | `newPath: string` | 另存为 |
| `file:pick-open` | R→M→R | — | `{ content, filePath } \| null` | 对话框选文件 |
| `file:pick-save` | R→M→R | — | `string \| null` | 对话框选保存路径 |

**IPC 处理注册**：

```typescript
// electron/ipc-handlers.ts
import { ipcMain, dialog } from 'electron';
import { FileService } from './services/file-service';

const fileService = new FileService();

ipcMain.handle('file:open', async (_event, filePath: string) => {
  return fileService.open(filePath);
});

ipcMain.handle('file:pick-open', async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    properties: ['openFile'],
  });
  if (result.canceled) return null;
  return fileService.open(result.filePaths[0]);
});

ipcMain.handle('file:save', async (_event, { filePath, content }) => {
  await fileService.save(filePath, content);
});
```

### 4.3 文件操作状态管理（渲染进程）

```typescript
// src/stores/file-store.ts
interface FileStore {
  currentFilePath: string | null;
  currentContent: string;
  isModified: boolean;
  isLoading: boolean;

  // Actions
  openFile: (filePath?: string) => Promise<void>;
  saveFile: () => Promise<void>;
  saveAsFile: () => Promise<void>;
  newFile: () => void;
}
```

**修改检测**：通过对比 `currentContent` 与编辑器实时内容实现：

```typescript
// App.tsx 中监听
useEffect(() => {
  if (content !== savedContentRef.current) {
    fileStore.getState().markModified(true);
  }
}, [content]);
```

### 4.4 文件操作快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+N` | 新建文件 |
| `Ctrl+O` | 打开文件 |
| `Ctrl+S` | 保存 |
| `Ctrl+Shift+S` | 另存为 |

快捷键通过 Electron 原生菜单 `accelerator` 实现，触发后通过 `webContents.send('menu:action', actionName)` 通知渲染进程。

---

## 5. 原生菜单与文件操作入口

### 5.1 菜单更新

在第二阶段将第一阶段占位的菜单项绑定实际功能：

```typescript
// electron/menu.ts
const fileMenu: MenuItemConstructorOptions = {
  label: '文件',
  submenu: [
    { label: '新建', accelerator: 'CmdOrCtrl+N', click: (_, win) =>
      win?.webContents.send('menu:action', 'file:new') },
    { label: '打开...', accelerator: 'CmdOrCtrl+O', click: (_, win) =>
      win?.webContents.send('menu:action', 'file:open') },
    { type: 'separator' },
    { label: '保存', accelerator: 'CmdOrCtrl+S', click: (_, win) =>
      win?.webContents.send('menu:action', 'file:save') },
    { label: '另存为...', accelerator: 'CmdOrCtrl+Shift+S', click: (_, win) =>
      win?.webContents.send('menu:action', 'file:save-as') },
  ],
};
```

### 5.2 文件修改提示

在关闭/切换文件时，通过 `dialog.showMessageBox` 弹出确认对话框：

```typescript
// 主进程监听
ipcMain.handle('file:confirm-save', async (_event) => {
  const result = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['保存', '不保存', '取消'],
    message: '文件已被修改，是否保存？',
  });
  return result.response; // 0=保存, 1=不保存, 2=取消
});
```

---

## 6. 组件交互流程

### 6.1 打开文件流程

```
用户点击 "打开"
     │
     ▼
主进程 dialog.showOpenDialog
     │
     ▼
用户选择 .md 文件
     │
     ▼
FileService.open(filePath) → 读取文件内容
     │
     ▼
IPC 返回 { content, filePath }
     │
     ▼
渲染进程更新 fileStore：
  1. 如有修改 → 弹出确认对话框
  2. currentFilePath = filePath
  3. editorStore.setContent(content)
     │
     ▼
EditorPane 接收新的 content，dispatch 到 CM6
PreviewPane 接收新的 content，调用 renderMarkdown
```

### 6.2 保存文件流程

```
用户 Ctrl+S
     │
     ▼
渲染进程 → IPC('file:save', { filePath, content })
     │
     ▼
主进程 FileService.save(filePath, content)
     │
     ▼
渲染进程收到响应：
  - isModified = false
  - 标题栏移除 "● 未保存" 标识
```

---

## 7. TypeScript 类型定义

```typescript
// src/types/electron.d.ts
interface ElectronAPI {
  getVersion: () => Promise<string>;
  openFile: (filePath?: string) => Promise<FileResult | null>;
  pickOpenFile: () => Promise<FileResult | null>;
  saveFile: (payload: { filePath: string; content: string }) => Promise<void>;
  saveAsFile: (content: string) => Promise<string | null>;
  confirmSave: () => Promise<0 | 1 | 2>;
  onMenuAction: (callback: (action: string) => void) => () => void;
}

// src/types/file.ts
interface FileResult {
  content: string;
  filePath: string;
}
```

---

## 8. 样式说明

### 8.1 编辑器与预览区基础样式

```css
/* src/styles/editor.css */
.editor-pane {
  height: 100%;
  overflow-y: auto;
}
.editor-pane .cm-editor {
  height: 100%;
  font-size: 15px;
  line-height: 1.7;
}
.editor-pane .cm-scroller {
  padding: 16px 20px;
}
```

```css
/* src/styles/preview.css */
.preview-pane {
  height: 100%;
  overflow-y: auto;
  padding: 16px 20px;
  line-height: 1.7;
}
/* 引用 github-markdown-css 基础样式 */
.preview-pane.markdown-body {
  box-sizing: border-box;
  min-width: 200px;
  max-width: 980px;
  margin: 0 auto;
}
```

### 8.2 分栏分割线

```css
.split-pane {
  display: flex;
  height: 100%;
}
.split-divider {
  width: 4px;
  cursor: col-resize;
  background: var(--border-color, #e0e0e0);
  transition: background 0.15s;
}
.split-divider:hover {
  background: var(--accent-color, #4a9eff);
}
```

---

## 9. 验收标准

| 功能 | 验收条件 |
|------|---------|
| 文本编辑 | 可在编辑器中正常输入、删除、选中文本 |
| Markdown 语法高亮 | 标题、加粗、斜体、列表、链接等语法有颜色区分 |
| 双栏预览 | 编辑区内容实时渲染为 HTML 显示在右侧 |
| 打开文件 | 通过菜单/快捷键可打开 .md 文件并显示内容 |
| 保存文件 | Ctrl+S 保存当前文件，标题栏显示保存状态 |
| 另存为 | Ctrl+Shift+S 弹出保存对话框，选择路径后写入 |
| 新建文件 | 清空编辑器内容，重置文件路径 |
| 未保存提示 | 修改内容后关闭/切换文件弹出确认对话框 |
| 菜单可用 | 文件菜单项功能均正常触发 |

---

## 10. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| CM6 学习曲线陡峭 | 编辑器集成进度延误 | 提前准备 CM6 最小示例，从读取内容 → 编辑 → 监听变更逐步搭建 |
| 大文件解析性能 | 渲染卡顿 | markdown-it 增量解析 + 虚拟滚动（保留后续优化空间） |
| 编码问题 | 非 UTF-8 文件乱码 | `readFile` 默认 utf-8，后续可加编码检测 |
| 文件被外部修改 | 内容冲突 | 可选的 `fs.watchFile` 检测外部变更并提示用户 |
