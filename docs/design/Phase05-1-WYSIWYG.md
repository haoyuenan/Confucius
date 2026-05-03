# 第五阶段-1 详细设计：即时渲染模式 (WYSIWYG)

**计划周期**：第 14-15 周  
**前置依赖**：Phase 1-4 全部完成  
**阶段目标**：实现双栏/即时渲染两种模式切换。WYSIWYG 模式下，编辑区内 Markdown 语法标记自动隐藏，渲染为富文本效果；光标移入标记区域时临时恢复显示语法标记。

---

## 1. 设计总览

### 1.1 双栏模式 vs 即时渲染模式对比

```
双栏模式（当前）               即时渲染模式（目标）
┌──────────┬──────────┐       ┌─────────────────────┐
│ 编辑器    │ 预览区    │       │ 混合视图              │
│ (源码)    │ (渲染)    │       │                      │
│          │          │       │ 标题文本              │
│ # 标题    │   标题   │       │ (无 # 标记，大字号)   │
│ **粗体**  │   粗体   │       │ 粗体 粗体            │
│          │          │       │ (远离光标时隐藏 **)   │
│          │          │       │ 光 标 移 入          │
│          │          │       │ 显示 ** 标记符 (灰色) │
├──────────┼──────────┤       │                      │
│ 双栏联动滚动│          │       │ 单栏，无预览区       │
└──────────┴──────────┘       └─────────────────────┘
```

### 1.2 核心概念

即时渲染的本质是**在编辑器中"混淆"源码文本与渲染效果**：

- **不丢弃语法符号**：`**粗体**` 在文档中不是单一"加粗"节点，而是三个连续标记：
  `"**"` (open marker) → `"粗体"` (content) → `"**"` (close marker)
- **默认隐藏标记**：`**`、`#`、`*` 等标记符默认 `width: 0; opacity: 0`，不可见
- **光标感知恢复**：光标距标记 < 3 个字符时，标记符恢复为灰色半透明可见
- **内容应用样式**：标记间的内容区域应用渲染样式（加粗、字体放大、斜体等）

### 1.3 架构概览

```
CM6 State (纯文本)
     │
     ▼
SyntaxMarker 分析器 (按扫描解析标记)
  - 正则扫描文档全文
  - 识别标记符范围 + 角色 (open/close/content)
  - 输出 SyntaxMarker[]
     │
     ▼
computeDecorations()
  - 遍历所有 Marker
  - 读取光标位置 cursorPos
  - 判断每个 marker 距光标的距离
  - 生成 DecorationSet:
      ├─ 标记远离光标 → hideMarker()         [opacity:0, width:0]
      ├─ 光标靠近标记 → hiddenMarkerDecoration [灰色可见]
      └─ 内容区域     → applyStyle(className) [加粗/标题/斜体]
     │
     ▼
CM6 View (随光标变化实时刷新)
```

---

## 2. SyntaxMarker 分析器（核心算法）

### 2.1 数据结构

```typescript
// src/editor/wysiwyg-plugin.ts —— 顶部类型定义

enum MarkerType {
  Heading,        // # ~ ######
  Bold,           // **...**
  Italic,         // *...*
  Strikethrough,  // ~~...~~
  InlineCode,     // `...`
  CodeBlock,      // ```...```
  Link,           // [text](url)
  Image,          // ![alt](url)
  List,           // - / * / 1.
  Quote,          // >
  HorizontalRule, // --- 或 ***
}

interface SyntaxMarker {
  from: number     // CM6 文档中的起始位置
  to: number       // 结束位置（exclusive）
  type: MarkerType
  role: 'open' | 'close' | 'content'
  /** 用于 heading 的层级 1-6 */
  level?: number
}
```

### 2.2 标记解析函数

```typescript
// 全量解析：每次 docChanged / selectionSet 时运行
function parseSyntaxMarkers(doc: string): SyntaxMarker[] {
  const markers: SyntaxMarker[] = []

  // ---- 1. 标题 # ~ ######（行首）----
  const headingRe = /^(#{1,6})\s/gm
  let m: RegExpExecArray | null
  while ((m = headingRe.exec(doc)) !== null) {
    const level = m[1].length as 1|2|3|4|5|6
    markers.push({
      from: m.index,
      to: m.index + m[0].length,  // "# " 整个标记
      type: MarkerType.Heading,
      role: 'open',
      level,
    })
  }

  // ---- 2. 加粗 **text**（非贪婪）----
  const boldRe = /\*\*(.+?)\*\*/gs
  while ((m = boldRe.exec(doc)) !== null) {
    markers.push(
      { from: m.index, to: m.index + 2, type: MarkerType.Bold, role: 'open' },
      { from: m.index + 2, to: m.index + m[0].length - 2, type: MarkerType.Bold, role: 'content' },
      { from: m.index + m[0].length - 2, to: m.index + m[0].length, type: MarkerType.Bold, role: 'close' },
    )
  }

  // ---- 3. 斜体 *text*（非贪婪，排除 ** 边界）----
  const italicRe = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g
  while ((m = italicRe.exec(doc)) !== null) {
    markers.push(
      { from: m.index, to: m.index + 1, type: MarkerType.Italic, role: 'open' },
      { from: m.index + 1, to: m.index + m[0].length - 1, type: MarkerType.Italic, role: 'content' },
      { from: m.index + m[0].length - 1, to: m.index + m[0].length, type: MarkerType.Italic, role: 'close' },
    )
  }

  // ---- 4. 删除线 ~~text~~ ----
  const strikeRe = /~~(.+?)~~/g
  while ((m = strikeRe.exec(doc)) !== null) {
    markers.push(
      { from: m.index, to: m.index + 2, type: MarkerType.Strikethrough, role: 'open' },
      { from: m.index + 2, to: m.index + m[0].length - 2, type: MarkerType.Strikethrough, role: 'content' },
      { from: m.index + m[0].length - 2, to: m.index + m[0].length, type: MarkerType.Strikethrough, role: 'close' },
    )
  }

  // ---- 5. 行内代码 `code` ----
  const codeRe = /`([^`]+)`/g
  while ((m = codeRe.exec(doc)) !== null) {
    markers.push(
      { from: m.index, to: m.index + 1, type: MarkerType.InlineCode, role: 'open' },
      { from: m.index + 1, to: m.index + m[0].length - 1, type: MarkerType.InlineCode, role: 'content' },
      { from: m.index + m[0].length - 1, to: m.index + m[0].length, type: MarkerType.InlineCode, role: 'close' },
    )
  }

  // ---- 6. 无序列表 "- " / "* "（行首）----
  const listRe = /^([-*])\s/gm
  while ((m = listRe.exec(doc)) !== null) {
    markers.push({
      from: m.index,
      to: m.index + m[0].length,
      type: MarkerType.List,
      role: 'open',
    })
  }

  // ---- 7. 引用 "> "（行首）----
  const quoteRe = /^(>)\s/gm
  while ((m = quoteRe.exec(doc)) !== null) {
    markers.push({
      from: m.index,
      to: m.index + m[0].length,
      type: MarkerType.Quote,
      role: 'open',
    })
  }

  return markers
}
```

### 2.3 光标距离判断

```typescript
/** 判断光标位置是否靠近某个标记 */
function isMarkerNearCursor(markerFrom: number, markerTo: number, cursorPos: number): boolean {
  const PROXIMITY_THRESHOLD = 3
  return (
    Math.abs(markerFrom - cursorPos) < PROXIMITY_THRESHOLD ||
    Math.abs(markerTo - cursorPos) < PROXIMITY_THRESHOLD
  )
}
```

**阈值说明**：`PROXIMITY_THRESHOLD = 3` 表示光标距标记首尾 3 个字符内时恢复显示。这意味着：
- 光标刚移入 `**` 或 `#` 区域时源码立即可见
- 光标移出标记 3 个字符后，标记再次隐藏
- 数值 3 是经验值，编辑代码块内容时可考虑扩展

---

## 3. WYSIWYG 插件实现

### 3.1 ViewPlugin 完整实现

```typescript
// src/editor/wysiwyg-plugin.ts —— 主插件

import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  PluginValue,
} from '@codemirror/view'

// ---------- 类型定义（同上）----------
// enum MarkerType, Interface SyntaxMarker, parseSyntaxMarkers(), isMarkerNearCursor()
// ---------- 装饰器工厂 ----------

/** 隐藏语法标记（width:0, opacity:0） */
function hideMarker(): Decoration {
  return Decoration.mark({
    class: 'cm-syntax-marker-hidden',
    inclusive: false,
  })
}

/** 灰色显示语法标记（光标附近） */
function showMarkerDim(): Decoration {
  return Decoration.mark({ class: 'cm-syntax-marker' })
}

/** 内容区域样式 */
function contentStyle(type: MarkerType, level?: number): Decoration {
  switch (type) {
    case MarkerType.Heading:
      return Decoration.mark({ class: `cm-heading cm-heading-h${level || 1}` })
    case MarkerType.Bold:
      return Decoration.mark({ class: 'cm-bold' })
    case MarkerType.Italic:
      return Decoration.mark({ class: 'cm-italic' })
    case MarkerType.Strikethrough:
      return Decoration.mark({ class: 'cm-strikethrough' })
    case MarkerType.InlineCode:
      return Decoration.mark({ class: 'cm-inline-code' })
    case MarkerType.List:
      return Decoration.mark({ class: 'cm-list-marker' })
    case MarkerType.Quote:
      return Decoration.mark({ class: 'cm-quote-marker' })
    default:
      return Decoration.mark({})
  }
}

// ---------- 插件主体 ----------

class WysiwygPlugin implements PluginValue {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.compute(view)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.compute(update.view)
    }
  }

  private compute(view: EditorView): DecorationSet {
    const doc = view.state.doc.toString()
    const cursorPos = view.state.selection.main.head
    const markers = parseSyntaxMarkers(doc)
    const decos: Decoration[] = []

    for (const m of markers) {
      if (m.role === 'open' || m.role === 'close') {
        // 语法标记：根据光标位置决定隐藏还是显示
        if (isMarkerNearCursor(m.from, m.to, cursorPos)) {
          decos.push(showMarkerDim().range(m.from, m.to))
        } else {
          decos.push(hideMarker().range(m.from, m.to))
        }
      } else {
        // 内容：始终应用渲染样式
        decos.push(contentStyle(m.type, m.level).range(m.from, m.to))
      }
    }

    return Decoration.set(decos, true)
  }

  destroy() {
    // 无需清理
  }
}

export function wysiwygMode() {
  return ViewPlugin.fromClass(WysiwygPlugin, {
    decorations: (v) => v.decorations,
  })
}
```

### 3.2 与 CM6 集成

更新 `cm6-setup.ts`，根据当前模式条件启用插件：

```typescript
// src/editor/cm6-setup.ts —— 修改点

import { wysiwygMode } from './wysiwyg-plugin'
import { useEditorStore } from '../stores/editor-store'

export function createEditorView(
  container: HTMLElement,
  onChange: (content: string) => void,
  /** 是否启用 WYSIWYG 模式 */
  enableWysiwyg = false,
): EditorView {
  // ... 现有代码 ...
  const extensions = [
    // ... 现有扩展 ...
  ]

  if (enableWysiwyg) {
    extensions.push(wysiwygMode())
  }

  // ...
}
```

---

## 4. 样式定义

### 4.1 WYSIWYG 专用样式

```css
/* src/styles/wysiwyg.css */

/* ---- 隐藏语法标记（默认状态）---- */
.cm-syntax-marker-hidden {
  display: inline-block;
  width: 0 !important;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  user-select: none;
  font-size: 0;
}

/* ---- 光标附近显示标记（灰色半透明）---- */
.cm-syntax-marker {
  opacity: 0.35;
  color: var(--text-muted, #959da5);
  font-size: 0.85em;
}

/* ---- 渲染样式 ---- */

/* 标题 */
.cm-heading {
  font-weight: 700;
  color: var(--text-primary);
}
.cm-heading-h1 { font-size: 2em; }
.cm-heading-h2 { font-size: 1.5em; }
.cm-heading-h3 { font-size: 1.25em; }
.cm-heading-h4 { font-size: 1.1em; }
.cm-heading-h5 { font-size: 1em; }
.cm-heading-h6 { font-size: 0.9em; }

/* 加粗 */
.cm-bold {
  font-weight: 700;
}

/* 斜体 */
.cm-italic {
  font-style: italic;
}

/* 删除线 */
.cm-strikethrough {
  text-decoration: line-through;
}

/* 行内代码 */
.cm-inline-code {
  background: var(--bg-secondary);
  border-radius: 3px;
  padding: 0 4px;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.85em;
}

/* 列表 / 引用标记符（在光标附近时灰色显示） */
.cm-list-marker,
.cm-quote-marker {
  /* 默认隐藏由 .cm-syntax-marker-hidden 控制 */
}
.cm-list-marker.cm-syntax-marker,
.cm-quote-marker.cm-syntax-marker {
  opacity: 0.35;
  color: var(--text-muted);
}
```

---

## 5. 模式切换系统

### 5.1 Store 扩展

```typescript
// src/stores/editor-store.ts —— 新增字段

type EditorMode = 'split' | 'wysiwyg'

interface EditorState {
  // ... 现有字段 ...
  mode: EditorMode
  setMode: (mode: EditorMode) => void
  toggleMode: () => void
}
```

```typescript
// store 实现中新增
mode: 'split' as EditorMode,
setMode: (mode) => set({ mode }),
toggleMode: () => set((s) => ({
  mode: s.mode === 'split' ? 'wysiwyg' : 'split',
})),
```

### 5.2 模式切换组件

```tsx
// src/components/Editor/ModeSwitch.tsx

import { useEditorStore } from '../../stores/editor-store'

function ModeSwitch() {
  const mode = useEditorStore((s) => s.mode)
  const toggleMode = useEditorStore((s) => s.toggleMode)

  return (
    <button
      className="mode-switch"
      onClick={toggleMode}
      title={
        mode === 'split'
          ? '切换到即时渲染模式'
          : '切换到双栏模式'
      }
    >
      {mode === 'split' ? '🎨 渲染' : '📝 源码'}
    </button>
  )
}

export default ModeSwitch
```

### 5.3 EditorLayout 双模式渲染

```tsx
// src/components/Editor/EditorLayout.tsx —— 修改

function EditorLayout() {
  const content = useEditorStore((s) => s.content)
  const setContent = useEditorStore((s) => s.setContent)
  const mode = useEditorStore((s) => s.mode)

  if (mode === 'wysiwyg') {
    // 即时渲染模式：全屏单栏编辑器
    return (
      <div className="wysiwyg-layout">
        <EditorPane
          initialContent={content}
          onContentChange={setContent}
          enableWysiwyg
        />
        {/* 无分隔线和预览区 */}
      </div>
    )
  }

  // 双栏模式（原有逻辑）
  return (
    <div className="split-pane">
      <ResizablePane defaultWidth="50%" minWidth={250}>
        <EditorPane
          initialContent={content}
          onContentChange={setContent}
        />
      </ResizablePane>
      <div className="split-divider" />
      <div className="preview-wrapper">
        <PreviewPane content={content} />
      </div>
    </div>
  )
}
```

### 5.4 菜单入口

```typescript
// electron/menu.ts —— 在"视图"菜单添加
{
  label: '切换编辑模式',
  accelerator: 'CmdOrCtrl+Shift+P',
  click: () => win.webContents.send('menu:action', 'mode:toggle'),
}
```

```typescript
// src/App.tsx —— 菜单处理器新增
case 'mode:toggle':
  useEditorStore.getState().toggleMode()
  break
```

---

## 6. 点击链接与图片预览

在 WYSIWYG 模式下，链接应可点击打开，图片应预览。

### 6.1 链接处理

CM6 不支持原生 `<a>` 标签。在 WYSIWYG 模式下，链接标记内容区域的 `Decoration` 需添加点击事件：

```typescript
// 在 compute() 中增加 link 标记的额外处理
// 链接格式：[text](url)
case MarkerType.Link: {
  // 提取 url 包装为可点击的 decoration
  // 使用 Decoration.replace 替换为自定义 DOM
  const urlMatch = doc.slice(m.from, m.to).match(/\[(.+?)\]\((.+?)\)/)
  if (urlMatch) {
    decos.push(
      Decoration.replace({
        widget: new LinkWidget(urlMatch[1], urlMatch[2]),
      }).range(m.from, m.to),
    )
  }
  break
}
```

```typescript
// LinkWidget 实现
import { WidgetType } from '@codemirror/view'

class LinkWidget extends WidgetType {
  constructor(private text: string, private url: string) { super() }

  toDOM() {
    const a = document.createElement('a')
    a.textContent = this.text
    a.href = this.url
    a.className = 'cm-link'
    a.title = `Ctrl+点击打开: ${this.url}`
    a.addEventListener('mousedown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        // 通过 IPC 打开外部链接
        window.electronAPI?.openExternal?.(this.url)
      }
    })
    return a
  }
}
```

> **注意**：`LinkWidget` 依赖 `electron/preload.ts` 暴露 `openExternal` API。未实现前可降级为不渲染链接。

### 6.2 图片预览

图片语法 `![alt](src)` 使用类似方式替换为 `<img>` 标签。

> **简化策略**：Phase05-1 不实现图片和链接 widget。链接和图片保持源码显示，标记回归为 `cm-syntax-marker-hidden`。这可显著降低实现复杂度。

---

## 7. 模式切换对 CM6 的影响

WYSIWYG 模式需要 CM6 实例**重建**（因为扩展集不同，包含 `wysiwygMode()` 插件）。

### 7.1 重建策略

```tsx
// EditorLayout.tsx —— 模式切换时用 key 触发重建

function EditorLayout() {
  const content = useEditorStore((s) => s.content)
  const setContent = useEditorStore((s) => s.setContent)
  const mode = useEditorStore((s) => s.mode)

  return (
    <div className={mode === 'wysiwyg' ? 'wysiwyg-layout' : 'split-pane'}>
      <EditorPane
        key={mode}                 // ← 模式切换时强制重建 CM6
        initialContent={content}
        onContentChange={setContent}
        enableWysiwyg={mode === 'wysiwyg'}
      />
      {mode === 'split' && (
        <>
          <div className="split-divider" />
          <div className="preview-wrapper">
            <PreviewPane content={content} />
          </div>
        </>
      )}
    </div>
  )
}
```

### 7.2 EditorPane 修改

```tsx
// src/components/Editor/EditorPane.tsx —— 新增 enableWysiwyg prop

interface EditorPaneProps {
  initialContent?: string
  onContentChange: (markdown: string) => void
  enableWysiwyg?: boolean
}

function EditorPane({ initialContent = '', onContentChange, enableWysiwyg = false }: EditorPaneProps) {
  const initView = useCallback(() => {
    if (!containerRef.current) return
    const view = createEditorView(
      containerRef.current,
      (content) => { onChangeRef.current(content) },
      enableWysiwyg,    // ← 传递给 cm6-setup
    )
    viewRef.current = view
  }, [enableWysiwyg])  // ← 依赖 enableWysiwyg

  // key 变化时 initView 的引用也变了，触发重建
  // ...
}
```

---

## 8. 局限与降级策略

| 场景 | WYSIWYG 模式行为 | 降级方案 |
|------|------------------|---------|
| 表格 `\| a \| b \|` | 保持源码显示，不做渲染 | 切换到双栏模式查看渲染效果 |
| 代码块 ` ``` ` | 内容区保持源码字体，不做高亮 | — |
| 水平线 `---` | 保持源码显示 | — |
| 链接 `[t](u)` | 保持源码显示（可点击 widget 可选实现） | Phase05-1 阶段不实现 |
| 图片 `![alt](src)` | 保持源码显示 | Phase05-1 阶段不实现 |
| Mermaid ` ```mermaid ` | 保持源码显示 | 切换到双栏模式查看 |
| 数学公式 `$...$` | 保持源码显示 | 切换到双栏模式查看 |
| 嵌套标记 `***text***` | 解析可能不准，优先外层匹配 | — |

**核心原则**：Phase05-1 只处理以下标记的渲染：
1. 标题 `# ~ ######`
2. 加粗 `**text**`
3. 斜体 `*text*`
4. 删除线 `~~text~~`
5. 行内代码 `` `code` ``
6. 无序列表 `- / * `（仅标记符隐藏）
7. 引用 `> `（仅标记符隐藏）

其余语法降级到双栏模式查看。

---

## 9. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/editor/wysiwyg-plugin.ts` | **新建** | WYSIWYG ViewPlugin、SyntaxMarker 解析器、Decoration 工厂 |
| `src/styles/wysiwyg.css` | **新建** | 标记隐藏、光标显示、渲染样式 |
| `src/editor/cm6-setup.ts` | **修改** | 新增 `enableWysiwyg` 参数，条件启用 WYSIWYG 插件 |
| `src/stores/editor-store.ts` | **修改** | 新增 `mode`、`setMode`、`toggleMode` |
| `src/components/Editor/EditorLayout.tsx` | **修改** | 根据 mode 渲染双栏或全屏 WYSIWYG |
| `src/components/Editor/EditorPane.tsx` | **修改** | 新增 `enableWysiwyg` prop，传递给 `createEditorView` |
| `src/components/Editor/ModeSwitch.tsx` | **新建** | 模式切换按钮 |
| `electron/menu.ts` | **修改** | 视图菜单添加"切换编辑模式" `Ctrl+Shift+P` |
| `src/App.tsx` | **修改** | 监听 `mode:toggle` 菜单动作 |
| `src/main.tsx` | **修改** | 导入 `wysiwyg.css` |

---

## 10. 验收标准

| 验收项 | 条件 |
|--------|------|
| 标题渲染 | WYSIWYG 模式下 `# 标题` 中的 `# ` 自动隐藏，文字放大加粗 |
| 加粗渲染 | `**text**` 中的 `**` 隐藏，text 加粗显示 |
| 斜体渲染 | `*text*` 中的 `*` 隐藏，text 斜体显示 |
| 删除线渲染 | `~~text~~` 中的 `~~` 隐藏，text 显示删除线 |
| 行内代码渲染 | `` `code` `` 中的反引号隐藏，code 显示代码样式 |
| 列表标记隐藏 | `- item` 的行首 `- ` 隐藏 |
| 引用标记隐藏 | `> quote` 的行首 `> ` 隐藏 |
| 光标感知 | 光标移入标记 3 字符内，标记恢复灰色显示 |
| 模式切换 | `Ctrl+Shift+P` 可在双栏和 WYSIWYG 模式间切换 |
| 切换后内容保留 | 切换模式后编辑器内容完整保留，无丢失 |
| 双栏模式不受影响 | 切换回双栏模式，原有编辑、预览、文件操作完全正常 |
