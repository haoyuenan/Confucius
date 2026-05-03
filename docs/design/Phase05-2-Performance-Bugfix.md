# 第五阶段-2 详细设计：专注模式、性能优化与全量 Bug 修复

**计划周期**：第 16 周  
**前置依赖**：Phase 1-4 + Phase05-1 全部完成  
**阶段目标**：实现专注模式（非活动行置灰）和打字机模式（编辑行居中），完成系统性能优化与全量 Bug 修复。

---

## 1. 专注模式

### 1.1 效果描述

- 开启后，编辑器中当前光标所在行保持完全不透明
- 其他所有行变为半透明（默认 `opacity: 0.3`）
- 光标上下移动时，激活行跟随切换
- 可选配置：仅当前段落高亮（以空行为段落边界）

### 1.2 实现方案

**技术选型**：使用 CM6 的 `EditorView.theme` + 动态 CSS 变量，无需自定义 ViewPlugin。

```css
/* src/editor/focus-mode.ts —— companion CSS 逻辑 */

/* 专注模式激活时，非激活行置灰 */
.focus-mode-active .cm-line:not(.cm-active-line) {
  opacity: var(--focus-dim-opacity, 0.3);
  transition: opacity 0.3s ease;
}
```

```typescript
// src/editor/focus-mode.ts

import { EditorView } from '@codemirror/view'

interface FocusModeConfig {
  enabled: boolean
  dimOpacity?: number
}

/** 在 CM6 容器上添加/移除 focus-mode 样式类 */
export function toggleFocusMode(view: EditorView | null, enabled: boolean, opacity = 0.3): void {
  if (!view) return
  const dom = view.dom
  dom.classList.toggle('focus-mode-active', enabled)
  dom.style.setProperty('--focus-dim-opacity', String(opacity))
}
```

### 1.3 菜单入口

```typescript
// electron/menu.ts —— 视图菜单
{
  label: '专注模式',
  type: 'checkbox',
  accelerator: 'F11',
  click: (menuItem, win) =>
    win?.webContents.send('menu:action', 'focus:mode'),
}
```

### 1.4 状态管理

```typescript
// src/stores/editor-store.ts —— 新增字段
focusMode: boolean
setFocusMode: (v: boolean) => void
toggleFocusMode: () => void
```

---

## 2. 打字机模式

### 2.1 效果描述

- 当前编辑行始终保持编辑器视口的垂直居中位置
- 随光标上下移动，编辑器自动滚动以保持居中
- 仅在 `focusMode` 同时开启时生效（增强版）

### 2.2 实现方案

```typescript
// src/editor/typewriter-mode.ts

import { EditorView, ViewUpdate } from '@codemirror/view'

/**
 * 返回一个 CM6 updateListener，在 selection 变化时自动滚动到居中位置
 */
export function typewriterScrollListener() {
  return EditorView.updateListener.of((update: ViewUpdate) => {
    if (!update.selectionSet) return
    scrollToCenter(update.view)
  })
}

function scrollToCenter(view: EditorView) {
  const cursorPos = view.state.selection.main.head
  const line = view.state.doc.lineAt(cursorPos)
  const lineBlock = view.lineBlockAt(line.from)
  if (!lineBlock) return

  const viewport = view.scrollDOM.getBoundingClientRect()
  const targetCenter = viewport.height / 2
  const currentPos = lineBlock.top - view.scrollDOM.scrollTop
  const currentCenter = currentPos + lineBlock.height / 2
  const diff = currentCenter - targetCenter

  if (Math.abs(diff) > 50) {
    view.scrollDOM.scrollBy({ top: diff, behavior: 'smooth' })
  }
}
```

### 2.3 与专注模式联动

```typescript
// 打字机模式作为专注模式的增强子选项
// 仅在 focusMode 开启时生效
if (focusMode && typewriterMode) {
  // 激活 typewriterScrollListener
}
```

### 2.4 菜单入口

```typescript
// electron/menu.ts —— 视图菜单
{
  label: '打字机模式',
  type: 'checkbox',
  enabled: false,  // 仅当专注模式开启时可用
  accelerator: 'F12',
  click: (menuItem, win) =>
    win?.webContents.send('menu:action', 'typewriter:mode'),
}
```

---

## 3. 性能优化

### 3.1 增量预览渲染（DOM Diff）

当前预览区每次内容变化都全量调用 `innerHTML = newHtml`，这会销毁所有 DOM 节点并重建，导致：
- Mermaid 和 KaTeX 需要重新渲染所有图表/公式
- 滚动位置丢失
- 不必要的 DOM 操作

**优化方案**：引入 `morphdom` 库，进行最小 DOM diff 更新。

```bash
npm install morphdom
npm install --save-dev @types/morphdom
```

```typescript
// src/utils/dom-diff.ts

import morphdom from 'morphdom'

/**
 * 使用 morphdom 增量更新预览区，避免全量 innerHTML 替换
 */
export function updatePreviewContent(
  container: HTMLElement,
  newHtml: string,
): void {
  const temp = document.createElement('div')
  temp.innerHTML = newHtml

  morphdom(container, temp, {
    childrenOnly: true,
    // 保留 Mermaid 已渲染的 SVG
    onBeforeElUpdated: (fromEl, toEl) => {
      // 跳过已渲染的 mermaid SVG
      if (fromEl.classList.contains('mermaid-rendered')) {
        return false
      }
      // 跳过 KaTeX 公式容器
      if (fromEl.tagName === 'SPAN' && fromEl.classList.contains('katex')) {
        return false
      }
      return true
    },
  })
}
```

**集成到 PreviewPane**：

```tsx
// src/components/Preview/PreviewPane.tsx —— 修改点

// 用 updatePreviewContent 替代 innerHTML
useEffect(() => {
  if (!previewRef.current) return

  // 第一次或全量重建时仍用 innerHTML
  if (isFirstRender.current) {
    previewRef.current.innerHTML = html
    isFirstRender.current = false
  } else {
    // 后续增量更新
    updatePreviewContent(previewRef.current, html)
  }

  renderMermaidDiagrams(previewRef.current).then(() => {
    renderMathInElement(previewRef.current!)
  })
}, [html])
```

> **注意**：morphdom 的 childrenOnly 选项会跳过容器本身，只更新内部子节点。配合 `onBeforeElUpdated` 回调跳过已渲染的 Mermaid SVG 和 KaTeX 元素，可避免重复渲染。

### 3.2 防抖策略规范

确认现有防抖配置已正确应用于所有高频场景：

```
预览更新   150ms   ✓（已在 cm6-setup.ts 的 updateListener 中）
搜索输入   300ms   ✓（已在 SearchPanel 的 debounceRef 中）
文件树刷新 500ms   ✓（已在 file-watcher.ts 的 debounceTimer 中）
大纲更新   200ms   ✗ 需要新增
```

```typescript
// src/editor/outline-parser.ts —— 导出防抖钩子
// outline 更新请使用以下防抖：

function useDebouncedOutline(doc: string, delay = 200) {
  // 已在 OutlinePanel 内置 useEffect，无额外防抖
  // 需要在 OutlinePanel.tsx 中添加防抖
}
```

### 3.3 XSS 安全防护

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

```typescript
// src/utils/sanitize.ts

import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'h1','h2','h3','h4','h5','h6',
  'p','br','hr',
  'ul','ol','li',
  'pre','code',
  'blockquote',
  'table','thead','tbody','tr','th','td',
  'a','img',
  'em','strong','del','ins','sub','sup',
  'span','div',
  'svg','path','g',          // Mermaid 渲染后的 SVG
]

const ALLOWED_ATTR = [
  'href','src','alt','title',
  'class','id','target',
  'width','height',
  'xmlns','viewBox','fill','stroke',
  'd','transform',
]

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  })
}
```

**集成到渲染管线**：

```typescript
// src/editor/markdown-renderer.ts —— 修改点
import { sanitizeHtml } from '../utils/sanitize'

export function renderMarkdown(text: string): string {
  const raw = md.render(text)
  return sanitizeHtml(raw)
}
```

### 3.4 大文件处理

```typescript
// src/editor/large-file-handler.ts

const LARGE_FILE_THRESHOLD = 1_000_000 // 1MB

export interface LargeFileInfo {
  isLarge: boolean
  size: number
}

export function checkLargeFile(size: number): LargeFileInfo {
  return { isLarge: size >= LARGE_FILE_THRESHOLD, size }
}

/** 打开大文件时建议禁用的功能 */
export const LARGE_FILE_DISABLED_FEATURES = {
  wysiwygMode: true,
  mermaid: true,
} as const
```

```typescript
// src/App.tsx —— 在 doOpenFile 中集成
import { checkLargeFile } from './editor/large-file-handler'

const handleOpenFile = useCallback(async () => {
  // ... 现有逻辑 ...
  try {
    const result = await window.electronAPI.readFile(file.filePath)
    // 检查大文件
    const largeFile = checkLargeFile(result.content.length) // length ≈ byte size
    if (largeFile.isLarge) {
      useEditorStore.getState().setIsLargeFile(true)
      // 强制切换到双栏模式
      useEditorStore.getState().setMode('split')
    } else {
      useEditorStore.getState().setIsLargeFile(false)
    }
    // ...
  }
}, [])
```

---

## 4. 全量 Bug 修复

### 4.1 P0 优先级（必须修复）

| Bug | 根因 | 修复方案 |
|-----|------|---------|
| 保存时路径含中文编码错误 | `fs.writeFile` 默认 UTF-8，需确认 | 在 `ipc-handlers.ts` 的 `file:write` 中确保 `'utf-8'` 编码参数 |
| 外部修改文件后内容冲突 | 当前无检测机制 | 在 `file-watcher.ts` 中检测到文件变更后，若当前编辑的文件是同一文件，发送消息给渲染进程提示用户 |
| HTML 标签 XSS 注入 | markdown-it 的 `html: true` 允许内嵌 HTML | 集成 DOMPurify 过滤（详见 3.3 节） |

### 4.2 P1 优先级

| Bug | 修复方案 |
|-----|---------|
| 嵌套加粗斜体 `***text***` 解析错误 | 在 `parseSyntaxMarkers()` 中先匹配 `**` 再 `*`（长优先） |
| 表格内换行符未处理 | markdown-it 的 `breaks: true` 会将 `\n` 渲染为 `<br>`，为表格内使用 `\` 转义 |
| 公式块在代码块内误渲染 | 在 KaTeX 后处理前检查父元素是否为 `code` 或 `pre`，跳过 |
| 切换文件时滚动位置未保存 | 切换文件前记录 `viewRef.current?.scrollDOM.scrollTop`，下次切回时恢复 |
| macOS 下 Cmd+W 关闭窗口未拦截 | 在 `electron/menu.ts` 中为 macOS 添加 `Cmd+W` 对应的 `menu:action` 处理 |
| PDF 导出代码块换行异常 | 导出 CSS 中设置 `pre { white-space: pre-wrap; overflow-wrap: break-word; }` |
| 导出含 Mermaid 图表报错 | 导出前等待 Mermaid 渲染完成（`await renderMermaidDiagrams()`） |

### 4.3 P2 优先级

| Bug | 修复方案 |
|-----|---------|
| 侧边栏宽度未持久化 | 在 `sidebarStore` 中读写 `localStorage` |
| 搜索高亮与光标选区冲突 | 搜索高亮使用 `<mark>` 标签而非 CSS 覆盖选区 |
| 文件拖放未支持 | 添加 `onDrop` 事件处理，拖入 .md 文件时打开 |

### 4.4 修复实施步骤

**步骤 1：编码修复**
```
a. ipc-handlers.ts   → 确保 file:write 编码为 utf-8
b. markdown-renderer.ts → 集成 DOMPurify
c. wysiwyg-plugin.ts   → 修复嵌套标记解析顺序
d. PreviewPane.tsx      → KaTeX 跳过 code/pre 内部的公式
e. App.tsx              → 保存/恢复滚动位置
f. menu.ts              → macOS Cmd+W 处理
g. export-service.ts    → 修复代码块换行和 Mermaid 等待
h. sidebar-store.ts     → 宽度持久化
```

**步骤 2：验证**
- 逐条对照 Bug 清单验证
- 确保修复不引入回归

---

## 5. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/editor/focus-mode.ts` | **新建** | 专注模式toggle逻辑 |
| `src/editor/typewriter-mode.ts` | **新建** | 打字机滚动居中逻辑 |
| `src/editor/cm6-setup.ts` | **修改** | 条件启用 typewriterScrollListener |
| `src/stores/editor-store.ts` | **修改** | 新增 focusMode / typewriterMode 状态 |
| `src/utils/dom-diff.ts` | **新建** | morphdom 增量预览更新 |
| `src/utils/sanitize.ts` | **新建** | DOMPurify HTML 安全过滤 |
| `src/editor/markdown-renderer.ts` | **修改** | 集成 sanitizeHtml |
| `src/components/Preview/PreviewPane.tsx` | **修改** | 集成 morphdom 增量更新 |
| `src/components/Preview/PreviewPane.tsx` | **修改** | KaTeX 跳过代码块内公式 |
| `src/editor/large-file-handler.ts` | **新建** | 大文件检测 |
| `src/App.tsx` | **修改** | 集成大文件检测、滚动位置保存 |
| `src/stores/sidebar-store.ts` | **修改** | 侧边栏宽度持久化 (localStorage) |
| `electron/menu.ts` | **修改** | 专注模式/打字机模式菜单项 |
| `electron/services/export-service.ts` | **修改** | 代码块换行、Mermaid 等待 |
| `electron/ipc-handlers.ts` | **修改** | 文件编码确认 |
| `package.json` | **修改** | 新增 morphdom + dompurify 依赖 |

---

## 6. 验收标准

| 验收项 | 条件 |
|--------|------|
| 专注模式 | 开启后非活动行半透明，光标移动时跟随|
| 打字机模式 | 开启后编辑行始终视口居中 |
| 菜单联动 | F11 切换专注模式，F12 切换打字机模式 |
| 预览增量更新 | 编辑文本时预览区不闪烁，滚动位置保持 |
| XSS 防护 | 文档中 `<script>alert(1)</script>` 不执行 |
| 大文件处理 | 打开 >1MB 文件时提示并降级功能 |
| 中文路径保存 | 文件名含中文时正常读写 |
| 嵌套标记 | `***text***` 正确解析为加粗+斜体 |
| 表格换行 | 表格内换行符不破坏表格结构 |
| 代码块内公式 | ` ``` ` 内的 `$...$` 不触发布局 |
| 滚动位置 | 切文件→切回，滚动位置恢复 |
| macOS Cmd+W | 触发文件修改提示后关闭 |
| 侧边栏宽度 | 调整后重启，宽度保持 |
| 文件拖放 | 拖入 .md 文件到窗口自动打开 |
