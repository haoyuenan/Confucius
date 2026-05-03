# 格式化工具栏详细设计文档

**计划周期**：Phase05 插入阶段（Phase05-1 与 Phase05-2 之间）  
**阶段目标**：在编辑器顶部增加可视化格式化工具栏，将快捷键能力以按钮形式呈现，覆盖加粗/标题/引用/代码块等常用操作。

---

## 1. 模块总览

```
┌──────────────────────────────────────────────────────────────────┐
│ FormatToolbar (固定 40px 高，位于编辑器顶部)                       │
│ ┌─ 标题 ──┐ ┌─ 行内格式 ─┐ ┌── 块级格式 ──┐ ┌── 插入 ─┐        │
│ │ H1 H2 H3 │ │  B  I  S  │ │  ❝  </> `  │ │ 🔗  🖼  │        │
│ └──────────┘ └───────────┘ └──────────────┘ └─────────┘        │
├──────────────────────────────────────────────────────────────────┤
│ EditorPane (CM6 编辑器) 或 EditorPane + PreviewPane(双栏)       │
└──────────────────────────────────────────────────────────────────┘
```

## 2. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/Editor/FormatToolbar.tsx` | **新建** | 工具栏 React 组件 |
| `src/editor/format-helpers.ts` | **新建** | 提取格式化函数，供快捷键和工具栏共用 |
| `src/editor/active-view.ts` | **新建** | 模块级 activeEditorView 引用 |
| `src/components/Editor/EditorLayout.tsx` | **修改** | 在 editor 顶部插入 `<FormatToolbar />` |
| `src/components/Editor/EditorPane.tsx` | **修改** | CM6 初始化后注册到 activeEditorView |
| `src/editor/keybindings.ts` | **修改** | 格式函数迁移到 format-helpers.ts，keybindings 作为包装 |
| `src/styles/toolbar.css` | **新建** | 工具栏按钮样式 |

## 3. 核心设计

### 3.1 模块级 EditorView 引用

工具栏组件与 CM6 EditorView 不在同一个组件层级，无法通过 props 直接传递视图引用。采用模块级变量跨组件共享。

```typescript
// src/editor/active-view.ts

import { EditorView } from 'codemirror'

/** 当前激活的 CM6 EditorView 实例 */
let activeView: EditorView | null = null

export function setActiveView(view: EditorView | null): void {
  activeView = view
}

export function getActiveView(): EditorView | null {
  return activeView
}
```

**EditorPane 集成**：

```typescript
// src/components/Editor/EditorPane.tsx —— 修改点

import { setActiveView } from '../../editor/active-view'

// 在 CM6 初始化后注册
useEffect(() => {
  if (!containerRef.current || viewRef.current) return
  const view = createEditorView(...)
  viewRef.current = view
  setActiveView(view)        // ← 注册
  return () => {
    setActiveView(null)      // ← 卸载时清空
    view.destroy()
    viewRef.current = null
  }
}, [])
```

### 3.2 格式化函数抽取

将 `keybindings.ts` 中的格式化逻辑抽取为独立的可复用函数，快捷键和工具栏共用同一套实现。

```typescript
// src/editor/format-helpers.ts

import { EditorView } from '@codemirror/view'

/** 插入标题：在行首插入 # / ## / ### */
export function insertHeading(view: EditorView, level: 1 | 2 | 3): boolean {
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  const prefix = '#'.repeat(level) + ' '
  // 如果行首已有标题，先清除旧标记再替换
  const existingMatch = line.text.match(/^(#{1,6})\s/)
  if (existingMatch) {
    view.dispatch({
      changes: {
        from: line.from,
        to: line.from + existingMatch[0].length,
        insert: prefix,
      },
    })
  } else {
    view.dispatch({
      changes: { from: line.from, insert: prefix },
      selection: { anchor: from + prefix.length },
    })
  }
  return true
}

/** 加粗 */
export function toggleBold(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  // 如果已选中内容以 ** 开头结尾，则去除（切换）
  if (selected.startsWith('**') && selected.endsWith('**') && selected.length > 4) {
    view.dispatch({
      changes: { from, to, insert: selected.slice(2, -2) },
      selection: { anchor: from, head: from + selected.length - 4 },
    })
  } else {
    view.dispatch({
      changes: { from, to, insert: `**${selected || '粗体'}**` },
      selection: { anchor: from + 2, head: from + 2 + selected.length },
    })
  }
  return true
}

/** 斜体 */
export function toggleItalic(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  if (selected.startsWith('*') && selected.endsWith('*') && !selected.startsWith('**') && selected.length > 2) {
    view.dispatch({
      changes: { from, to, insert: selected.slice(1, -1) },
      selection: { anchor: from, head: from + selected.length - 2 },
    })
  } else {
    view.dispatch({
      changes: { from, to, insert: `*${selected || '斜体'}*` },
      selection: { anchor: from + 1, head: from + 1 + selected.length },
    })
  }
  return true
}

/** 删除线 */
export function toggleStrikethrough(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  if (selected.startsWith('~~') && selected.endsWith('~~') && selected.length > 4) {
    view.dispatch({
      changes: { from, to, insert: selected.slice(2, -2) },
      selection: { anchor: from, head: from + selected.length - 4 },
    })
  } else {
    view.dispatch({
      changes: { from, to, insert: `~~${selected || '文本'}~~` },
      selection: { anchor: from + 2, head: from + 2 + selected.length },
    })
  }
  return true
}

/** 引用 */
export function toggleBlockquote(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const lines = (selected || '引用').split('\n')
  // 检查是否已有 > 前缀（切换）
  const allQuoted = lines.every(l => l.startsWith('> '))
  const result = allQuoted
    ? lines.map(l => l.slice(2)).join('\n')
    : lines.map(l => `> ${l}`).join('\n')
  view.dispatch({ changes: { from, to, insert: result } })
  return true
}

/** 代码块 */
export function insertCodeBlock(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const insertion = selected ? `\`\`\`\n${selected}\n\`\`\`` : '```\n\n```'
  view.dispatch({ changes: { from, to, insert: insertion } })
  return true
}

/** 行内代码 */
export function toggleInlineCode(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  view.dispatch({
    changes: { from, to, insert: `\`${selected || 'code'}\`` },
    selection: { anchor: from + 1, head: from + 1 + selected.length },
  })
  return true
}

/** 无序列表 */
export function insertUnorderedList(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const lines = (selected || '列表项').split('\n').map(l => `- ${l}`).join('\n')
  view.dispatch({ changes: { from, to, insert: lines } })
  return true
}

/** 有序列表 */
export function insertOrderedList(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const lines = (selected || '列表项').split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n')
  view.dispatch({ changes: { from, to, insert: lines } })
  return true
}

/** 链接 */
export function insertLink(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const text = selected || '链接文本'
  view.dispatch({
    changes: { from, to, insert: `[${text}](url)` },
    selection: { anchor: from, head: from + text.length + 7 },
  })
  return true
}

/** 图片 */
export function insertImage(view: EditorView): boolean {
  const { from } = view.state.selection.main
  view.dispatch({
    changes: { from, insert: '![图片描述](url)' },
    selection: { anchor: from + 7, head: from + 10 },
  })
  return true
}

/** 分割线 */
export function insertHorizontalRule(view: EditorView): boolean {
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  view.dispatch({
    changes: { from: line.from, insert: '---\n' },
  })
  return true
}
```

### 3.3 工具栏组件

```tsx
// src/components/Editor/FormatToolbar.tsx

interface ToolbarButton {
  label: string        // 按钮显示文字
  icon: string         // 图标文字或符号
  title: string        // tooltip
  shortcut?: string    // 快捷键提示
  action: () => void   // 执行操作
  divider?: 'before' | 'after'  // 分隔线
}

/** 分组定义 */
const BUTTON_GROUPS = [
  // 标题组
  [
    { label: 'H1', icon: 'H1', title: '一级标题', action: () => exec('heading', 1) },
    { label: 'H2', icon: 'H2', title: '二级标题', action: () => exec('heading', 2) },
    { label: 'H3', icon: 'H3', title: '三级标题', action: () => exec('heading', 3) },
  ],
  // 行内格式组
  [
    { label: 'B', icon: 'B', title: '加粗 (Ctrl+B)', action: () => exec('bold') },
    { label: 'I', icon: 'I', title: '斜体 (Ctrl+I)', action: () => exec('italic') },
    { label: 'S', icon: 'S', title: '删除线', action: () => exec('strikethrough') },
  ],
  // 块级格式组
  [
    { label: '引用', icon: '❝', title: '引用 (Ctrl+Shift+[)', action: () => exec('blockquote') },
    { label: '代码块', icon: '</>', title: '代码块 (Ctrl+Shift+`)', action: () => exec('codeblock') },
    { label: '行内代码', icon: '`', title: '行内代码 (Ctrl+`)', action: () => exec('inlinecode') },
    { label: '无序列表', icon: '•', title: '无序列表 (Ctrl+Shift+L)', action: () => exec('unordered-list') },
    { label: '有序列表', icon: '1.', title: '有序列表 (Ctrl+Shift+O)', action: () => exec('ordered-list') },
  ],
  // 插入组
  [
    { label: '链接', icon: '🔗', title: '链接 (Ctrl+K)', action: () => exec('link') },
    { label: '图片', icon: '🖼', title: '图片', action: () => exec('image') },
    { label: '分割线', icon: '—', title: '分割线', action: () => exec('hr') },
  ],
]
```

**组件渲染**：每组渲染在一行内，组间用 1px 分隔线。

### 3.4 执行器函数

```typescript
// FormatToolbar.tsx 内部

function exec(command: string, level?: number): void {
  const view = getActiveView()
  if (!view) return
  view.focus()

  switch (command) {
    case 'heading':     insertHeading(view, level as 1 | 2 | 3); break
    case 'bold':        toggleBold(view); break
    case 'italic':      toggleItalic(view); break
    case 'strikethrough': toggleStrikethrough(view); break
    case 'blockquote':  toggleBlockquote(view); break
    case 'codeblock':   insertCodeBlock(view); break
    case 'inlinecode':  toggleInlineCode(view); break
    case 'unordered-list': insertUnorderedList(view); break
    case 'ordered-list':   insertOrderedList(view); break
    case 'link':        insertLink(view); break
    case 'image':       insertImage(view); break
    case 'hr':          insertHorizontalRule(view); break
  }
}
```

### 3.5 与 EditorLayout 集成

```tsx
// src/components/Editor/EditorLayout.tsx —— 修改

function EditorLayout() {
  const content = useEditorStore((s) => s.content)
  const setContent = useEditorStore((s) => s.setContent)
  const mode = useEditorStore((s) => s.mode)

  return (
    <div className="editor-area" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <FormatToolbar />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {mode === 'wysiwyg' ? (
          <div className="wysiwyg-layout" style={{ height: '100%' }}>
            <EditorPane
              initialContent={content}
              onContentChange={setContent}
              enableWysiwyg
            />
          </div>
        ) : (
          <div className="split-pane">
            <ResizablePane ...>
              <EditorPane ... />
            </ResizablePane>
            <div className="split-divider" />
            <div className="preview-wrapper">
              <PreviewPane content={content} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

## 4. 样式设计

```css
/* src/styles/toolbar.css */

.format-toolbar {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 8px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
  gap: 2px;
  user-select: none;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: var(--border-color);
  margin: 0 6px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 30px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  position: relative;
  transition: background 0.1s, color 0.1s;
}

.toolbar-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.toolbar-btn:active {
  background: var(--border-color);
}

/* 文字型按钮（引用、代码块等） */
.toolbar-btn.label-btn {
  width: auto;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 500;
}

/* Tooltip */
.toolbar-btn::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  background: #1f2328;
  color: #fff;
  font-size: 11px;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
  margin-bottom: 4px;
}

.toolbar-btn:hover::after {
  opacity: 1;
}

/* 暗色主题 tooltip */
[data-theme='dark'] .toolbar-btn::after {
  background: #d4d4d4;
  color: #1e1e1e;
}
```

## 5. 验收标准

| 验收项 | 条件 |
|--------|------|
| 工具栏显示 | 编辑器顶部显示完整工具栏，高度 40px，含 13 个按钮 |
| 分组可见 | 标题/行内/块级/插入四个分组，组间有分隔线 |
| H1 按钮 | 点击后在光标行首插入 `# ` |
| H2 按钮 | 点击后在光标行首插入 `## ` |
| H3 按钮 | 点击后在光标行首插入 `### ` |
| 加粗 | 选中文本点击 B，包裹 `**`；再次点击去除 |
| 斜体 | 选中文本点击 I，包裹 `*`；再次点击去除 |
| 删除线 | 选中文本点击 S，包裹 `~~`；再次点击去除 |
| 引用 | 选中文本点击 ❝，每行前加 `> `；再次点击去除 |
| 代码块 | 选中文本点击 `</>`，包裹 `` ``` `` |
| 行内代码 | 选中文本点击 `` ` ``，包裹反引号 |
| 列表 | 选中多行点击 • 或 1.，前缀 `- ` 或 `1. ` |
| 链接 | 点击 🔗，插入 `[text](url)` 并选中 url |
| 图片 | 点击 🖼，插入 `![alt](url)` |
| 分割线 | 点击 —，行首插入 `---` |
| hover tooltip | 悬停按钮时显示功能名 + 快捷键 |
| 模式兼容 | split 和 WYSIWYG 模式下工具栏均正常工作 |
| 主题跟随 | 工具栏背景色、文字色、边框色跟随当前主题 |
