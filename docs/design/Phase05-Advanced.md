# 第五阶段详细设计：高级功能与性能优化

**计划周期**：第 14-16 周  
**阶段目标**：实现"所见即所得"(WYSIWYG) 即时渲染模式，添加专注模式/打字机模式，进行系统性能优化与全量 Bug 修复。

---

## 1. 模块总览

```
Phase 5 功能矩阵
┌──────────────────────────────────────────────────────────────┐
│                      渲染进程 (React)                          │
│                                                               │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  │
│  │ 即时渲染模式 (WYSIWYG)     │  │ 专注模式                  │  │
│  │                          │  │                          │  │
│  │ 当前实现：双栏模式         │  │ 当前段落高亮              │  │
│  │ 目标实现：单栏混合模式     │  │ 其余段落置灰              │  │
│  │                          │  │ 打字机模式（焦点行居中）  │  │
│  │ SyntaxMarker Decoration  │  │                          │  │
│  │ 光标感知标记显隐          │  └──────────────────────────┘  │
│  │ 编辑事务流转              │                                 │
│  └──────────────────────────┘                                 │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 性能优化                                                    │ │
│  │  • 大文件分段渲染 • 防抖节流 • 增量解析                      │ │
│  │  • 虚拟滚动 (超大文档) • 延迟加载 (侧边栏/图片)              │ │
│  │  • 内存泄漏排查 • CSS containment                             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 全量 Bug 修复                                              │ │
│  │  • 边界情况处理 • 跨平台兼容 • 编码问题                      │ │
│  │  • 文件冲突处理 • 撤销栈溢出 • 快捷键冲突                    │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 即时渲染模式（WYSIWYG）

### 2.1 什么是即时渲染

双栏模式（当前） vs 即时渲染模式（目标）：

```
双栏模式                   即时渲染模式
┌─────────┬─────────┐    ┌─────────────────┐
│ 编辑器   │ 预览区   │    │  混合视图         │
│ (源码)   │ (渲染)   │    │                  │
│         │         │    │  标题文本         │
│ # 标题   │  标题   │    │  (无 # 标记)     │
│ **粗体** │  粗体   │    │  粗体 粗体       │
│         │         │    │  (有光标时显示 **) │
│ 编辑区   │ 渲染区   │    │                  │
├─────────┼─────────┤    │  光标移入时       │
│ 双栏滚动  │         │    │  显示所有标记符   │
│ 联动     │         │    │                  │
└─────────┴─────────┘    └─────────────────┘
```

### 2.2 核心设计概念

即时渲染的核心在于**混淆源码文本与渲染节点**：

- **数据结构**：不丢弃语法符号。`**粗体**` 在文档树中并非一个"加粗"节点，而是一个序列：
  `"**"` (标记为语法符号「SyntaxMarker」) → `"粗体"` (标记为加粗文本) → `"**"` (标记为语法符号)

- **显示逻辑**：通过 Decoration 插件，根据节点类型和属性动态决定在编辑器中显示还是隐藏标记。光标移入 → 显示源码，光标移出 → 隐藏标记显示渲染效果。

### 2.3 CodeMirror 6 实现方案

CodeMirror 6 提供了好用的 Decoration 机制来实现这个效果。

#### 整体架构

```
CM6 State (文档内容)
     │
     ▼
markdown-it 解析 → 得到 tokens
     │
     ▼
SyntaxMarker 分析器
  - 遍历 tokens
  - 识别标记符类型（** / * / # / ` 等）
  - 生成标记范围
     │
     ▼
Decoration 应用
  ├── 标记隐藏 (隐藏 ** / * / #)
  └── 样式应用 (加粗 / 斜体 / 标题)
     │
     ▼
CM6 View (渲染输出)

光标位置检测
     │
     ▼
光标附近的标记 → 临时显示源码
```

#### Decoration 插件

```typescript
// src/editor/wysiwyg-plugin.ts
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  PluginValue,
} from '@codemirror/view';
import { StateField, StateEffect, RangeSet } from '@codemirror/state';

// 定义标记类型枚举
enum MarkerType {
  Heading,      // #, ##, ...
  Bold,         // **
  Italic,       // *
  Code,         // `
  CodeBlock,    // ```
  Link,         // [text](url)
  Image,        // ![alt](url)
  Strikethrough, // ~~
  List,         // - / 1.
  Quote,        // >
  Horizontal,   // ---
  Table,        // | ... |
}

interface SyntaxMarker {
  from: number;
  to: number;
  type: MarkerType;
  role: 'open' | 'close' | 'content';
}

// 定义装饰效果
const headingDecoration = Decoration.mark({ class: 'cm-heading' });
const boldDecoration = Decoration.mark({ class: 'cm-bold' });
const italicDecoration = Decoration.mark({ class: 'cm-italic' });
const hiddenMarkerDecoration = Decoration.mark({ class: 'cm-syntax-marker' });

// 隐藏语法标记的装饰
function hideMarker(): Decoration {
  return Decoration.mark({
    class: 'cm-syntax-marker-hidden',
    attributes: { 'data-marker': 'true' },
    inclusive: false,
  });
}

// 应用样式（不隐藏标记）
function applyStyle(className: string): Decoration {
  return Decoration.mark({ class: className });
}

// WYSIWYG 视图插件
class WysiwygPlugin implements PluginValue {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.computeDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.computeDecorations(update.view);
    }
  }

  private computeDecorations(view: EditorView): DecorationSet {
    const doc = view.state.doc.toString();
    const cursorPos = view.state.selection.main.head;
    const markers = this.parseSyntaxMarkers(doc);

    const decorations: Decoration[] = [];

    for (const marker of markers) {
      const isNearCursor = Math.abs(marker.from - cursorPos) < 3
        || Math.abs(marker.to - cursorPos) < 3;

      if (marker.role === 'open' || marker.role === 'close') {
        // 语法标记符
        if (isNearCursor) {
          // 靠近光标 → 显示标记（但加灰色样式）
          decorations.push(
            hiddenMarkerDecoration.range(marker.from, marker.to)
          );
        } else {
          // 远离光标 → 隐藏标记
          decorations.push(
            hideMarker().range(marker.from, marker.to)
          );
        }
      } else {
        // 内容区域 → 应用样式
        decorations.push(
          this.getContentDecoration(marker.type).range(marker.from, marker.to)
        );
      }
    }

    return Decoration.set(decorations, true);
  }

  private parseSyntaxMarkers(doc: string): SyntaxMarker[] {
    const markers: SyntaxMarker[] = [];

    // 解析加粗 **...**
    const boldRegex = /\*\*(.+?)\*\*/g;
    let match: RegExpExecArray | null;
    while ((match = boldRegex.exec(doc)) !== null) {
      markers.push(
        { from: match.index, to: match.index + 2, type: MarkerType.Bold, role: 'open' },
        { from: match.index + 2, to: match.index + 2 + match[1].length, type: MarkerType.Bold, role: 'content' },
        { from: match.index + 2 + match[1].length, to: match.index + match[0].length, type: MarkerType.Bold, role: 'close' }
      );
    }

    // 解析斜体 *...*
    const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;
    while ((match = italicRegex.exec(doc)) !== null) {
      markers.push(
        { from: match.index, to: match.index + 1, type: MarkerType.Italic, role: 'open' },
        { from: match.index + 1, to: match.index + 1 + match[1].length, type: MarkerType.Italic, role: 'content' },
        { from: match.index + 1 + match[1].length, to: match.index + match[0].length, type: MarkerType.Italic, role: 'close' }
      );
    }

    // 解析标题 # ...（行首）
    const lines = doc.split('\n');
    let offset = 0;
    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s/);
      if (headingMatch) {
        markers.push(
          { from: offset, to: offset + headingMatch[0].length, type: MarkerType.Heading, role: 'open' }
        );
      }
      offset += line.length + 1; // +1 for \n
    }

    // TODO: 解析更多标记（代码块、链接、列表、引用等）

    return markers;
  }

  private getContentDecoration(type: MarkerType): Decoration {
    switch (type) {
      case MarkerType.Heading: return Decoration.mark({ class: 'cm-heading' });
      case MarkerType.Bold: return Decoration.mark({ class: 'cm-bold' });
      case MarkerType.Italic: return Decoration.mark({ class: 'cm-italic' });
      default: return Decoration.mark({});
    }
  }

  destroy() {}
}

// 导出插件扩展
export function wysiwygMode() {
  return ViewPlugin.fromClass(WysiwygPlugin, {
    decorations: v => v.decorations,
  });
}
```

### 2.4 样式定义

```css
/* src/styles/wysiwyg.css */

/* 隐藏标记符（默认不可见，占用 0 宽度） */
.cm-syntax-marker-hidden {
  display: inline-block;
  width: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  user-select: none;
}

/* 显示标记符（靠近光标时恢复） */
.cm-syntax-marker {
  opacity: 0.4;
  color: var(--text-muted, #959da5);
  font-size: 0.9em;
}

/* 渲染样式 */
.cm-heading {
  font-weight: 700;
  color: var(--text-primary, #24292e);
}
.cm-heading.cm-heading-h1 { font-size: 2em; }
.cm-heading.cm-heading-h2 { font-size: 1.5em; }
.cm-heading.cm-heading-h3 { font-size: 1.25em; }

.cm-bold {
  font-weight: 700;
}

.cm-italic {
  font-style: italic;
}

.cm-strikethrough {
  text-decoration: line-through;
}
```

### 2.5 模式切换

提供双栏模式与即时渲染模式的切换：

```typescript
// src/stores/editor-store.ts（扩展）
type EditorMode = 'split' | 'wysiwyg';

interface EditorStore {
  mode: EditorMode;
  switchMode: (mode: EditorMode) => void;
}
```

```tsx
// 模式切换按钮
function ModeSwitch() {
  const mode = useEditorStore(s => s.mode);
  const switchMode = useEditorStore(s => s.switchMode);

  return (
    <button
      className="mode-switch"
      onClick={() => switchMode(mode === 'split' ? 'wysiwyg' : 'split')}
      title={mode === 'split' ? '切换到即时渲染模式' : '切换到双栏模式'}
    >
      {mode === 'split' ? '📝 源码' : '🎨 渲染'}
    </button>
  );
}
```

在即时渲染模式下：
- 编辑器全屏占据（无预览区分割）
- CM6 启用 WYSIWYG 插件
- 状态栏显示当前模式

### 2.6 局限与边界

- **表格**：即时渲染模式下表格难以完美展示，可回退到双栏模式查看
- **代码块**：代码块内保持源码显示，不做渲染
- **链接**：渲染为可点击链接（按住 Ctrl 点击打开）
- **图片**：渲染为图片预览（需预加载）

---

## 3. 专注模式与打字机模式

### 3.1 专注模式

```typescript
// src/editor/focus-mode.ts
interface FocusModeOptions {
  enabled: boolean;
  // 当前段落外的不透明度
  dimOpacity: number;
  // 是否启用打字机模式
  typewriterMode: boolean;
}
```

**实现方案**：在 CM6 上叠加半透明遮罩层。

```css
/* 专注模式 */
.focus-mode-active .cm-line:not(.cm-active-line) {
  opacity: var(--focus-dim-opacity, 0.3);
  transition: opacity 0.3s ease;
}
```

**行为**：
- 当前光标所在行保持完全可见
- 其他行变为半透明（默认 `opacity: 0.3`）
- 键盘上下移动时，激活行跟随变化
- 可选：仅当前段落高亮（以空行为段落分割）

### 3.2 打字机模式

打字机模式是专注模式的增强版：当前编辑行始终保持在视口垂直居中位置。

```typescript
// src/editor/typewriter-mode.ts
export function enableTypewriterMode(view: EditorView) {
  // 每次光标位置变化时
  const listener = EditorView.updateListener.of((update: ViewUpdate) => {
    if (update.selectionSet && update.view) {
      const cursorLine = update.view.state.selection.main.head;
      const line = update.view.state.doc.lineAt(cursorLine);
      const lineBlock = update.view.lineBlockAt(line.from);

      if (lineBlock) {
        const viewport = update.view.scrollDOM.getBoundingClientRect();
        const targetCenter = viewport.height / 2;
        const currentPos = lineBlock.top - update.view.scrollDOM.scrollTop;
        const currentCenter = currentPos + lineBlock.height / 2;
        const diff = currentCenter - targetCenter;

        if (Math.abs(diff) > 50) { // 避免微调抖动
          update.view.scrollDOM.scrollBy({
            top: diff,
            behavior: 'smooth',
          });
        }
      }
    }
  });

  return listener;
}
```

### 3.3 开关入口

可在状态栏或菜单「视图」中切换：

```typescript
// electron/menu.ts（视图菜单扩展）
{
  label: '视图',
  submenu: [
    { label: '侧边栏', accelerator: 'CmdOrCtrl+\\', click: toggleSidebar },
    { type: 'separator' },
    { label: '专注模式', type: 'checkbox', checked: false,
      click: (menuItem, win) => win?.webContents.send('menu:action', 'focus-mode') },
    { label: '打字机模式', type: 'checkbox', checked: false,
      click: (menuItem, win) => win?.webContents.send('menu:action', 'typewriter-mode') },
  ],
}
```

---

## 4. 性能优化

### 4.1 性能问题清单

| 场景 | 风险 | 优化方案 |
|------|------|---------|
| 超大文件（>5000行） | 编辑器卡顿 | 增量渲染、虚拟行 |
| markdown-it 全量渲染 | 预览更新延迟 | 增量解析、DOM diff |
| 频繁触发搜索 | 主线程阻塞 | 防抖、debounce、Web Worker |
| 文件树大量节点 | 侧边栏滚动卡顿 | 虚拟滚动 |
| 图片加载 | 滚动抖动 | 懒加载、占位图 |
| Mermaid 图表 | 渲染阻塞 | 延迟渲染、空闲调度 |
| 内存泄漏 | 长时间使用后性能下降 | 组件卸载清理、引用兜底 |

### 4.2 增量预览渲染

当前方案：每次内容变化都全量调用 `renderMarkdown()` → 全量替换 `innerHTML`。

**优化方案**：使用 DOM diff（最小的 DOM 操作）：

```typescript
// 方案 A：使用 morphdom 库进行高效的 DOM 更新
import morphdom from 'morphdom';

function updatePreview(previewEl: HTMLElement, newHtml: string) {
  const temp = document.createElement('div');
  temp.innerHTML = newHtml;
  morphdom(previewEl, temp, {
    // 只更新 .preview-pane 内部
    childrenOnly: true,
  });
}
```

### 4.3 编辑器防抖策略

```typescript
// 防抖层级配置
const DEBOUNCE_CONFIG = {
  preview: 150,    // 预览更新防抖 150ms
  search: 300,     // 搜索防抖 300ms
  outline: 200,    // 大纲更新防抖 200ms
  fileTree: 500,   // 文件树变更防抖 500ms
  mermaid: 500,    // 图表渲染防抖 500ms
};
```

### 4.4 大文件处理

对于超大文件（>1MB 或 >10000 行）：

```typescript
// src/editor/large-file-handler.ts
const LARGE_FILE_THRESHOLD = 1_000_000; // 1MB

async function openFileSafely(filePath: string): Promise<void> {
  const stats = await fs.stat(filePath);
  const isLargeFile = stats.size > LARGE_FILE_THRESHOLD;

  if (isLargeFile) {
    // 提示用户
    const confirmed = await confirmLargeFileOpen(stats.size);
    if (!confirmed) return;

    // 对大文件禁用高级功能
    disableWysiwygMode();
    disableSearchHighlight();
    disableOutlineAutoUpdate();
    disableMermaid();
  }

  // 读取内容并加载
  const content = await fs.readFile(filePath, 'utf-8');
  // ...
}
```

### 4.5 虚拟滚动

如果文档超长（>10000 行），考虑实现虚拟滚动。但 CodeMirror 6 本身就具备虚拟渲染能力（通过 `viewport` 机制），CM6 默认只渲染视口附近的行。一般不需要额外实现。

### 4.6 内存泄漏防范

关键排查点：

1. **CM6 EditorView 卸载清理**：`useEffect 返回 view.destroy()`
2. **chokidar watcher 关闭**：切换文件夹时关闭旧 watcher
3. **定时器清理**：所有 `setTimeout`/`setInterval` 在组件卸载时清理
4. **IPC 监听器移除**：主进程 `ipcMain.removeHandler()`
5. **大对象引用释放**：文档内容变更时及时释放旧内容引用

---

## 5. 全量 Bug 修复

### 5.1 Bug 分类清单

| 类别 | 典型 Bug | 优先级 |
|------|---------|--------|
| **文件操作** | 保存时路径含中文编码错误 | P0 |
| | 外部修改文件后内容冲突 | P0 |
| | 软链接、符号链接导致循环引用 | P1 |
| | 拖放文件到编辑器未支持 | P2 |
| **渲染** | 嵌套加粗斜体 `***text***` 解析错误 | P1 |
| | HTML 标签 XSS 注入风险 | P0 |
| | 表格内换行符未处理 | P1 |
| | 公式块在代码块内误渲染 | P1 |
| **UI** | 侧边栏宽度记忆未持久化 | P2 |
| | 切换文件时滚动位置未保存 | P1 |
| | 搜索高亮与光标选区同时显示冲突 | P2 |
| | 暗色主题下部分组件对比度过低 | P1 |
| **快捷键** | 与其他应用快捷键冲突 | P1 |
| | macOS 下 `Cmd+W` 关闭窗口未拦截 | P1 |
| **导出** | PDF 导出的代码块换行异常 | P1 |
| | HTML 导出未内嵌中文字体 | P2 |
| | 导出含 Mermaid 图表的 HTML 时报错 | P1 |

### 5.2 安全问题

```typescript
// 渲染 Markdown 时的 XSS 防护
// 虽然 markdown-it 提供了 html: true 选项
// 但需要额外过滤危险标签
import DOMPurify from 'dompurify';

function renderAndSanitize(markdown: string): string {
  const rawHtml = md.render(markdown);
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'h1','h2','h3','h4','h5','h6',
      'p','br','hr',
      'ul','ol','li',
      'pre','code',
      'blockquote',
      'table','thead','tbody','tr','th','td',
      'a','img',
      'em','strong','del','ins','sub','sup',
      'span','div',
    ],
    ALLOWED_ATTR: ['href','src','alt','title','class','id','target'],
    ALLOW_DATA_ATTR: false,
  });
}
```

### 5.3 跨平台兼容

| 问题 | Windows | macOS | Linux | 处理方式 |
|------|---------|-------|-------|---------|
| 路径分隔符 | `\\` | `/` | `/` | 统一使用 `path.join()` |
| 换行符 | `\r\n` | `\n` | `\n` | 保存时统一为 `\n`，读取时兼容 `\r\n` |
| 快捷键 | `Ctrl` | `Cmd` | `Ctrl` | 使用 CM6 的 `Mod` 前缀自动适配 |
| 菜单键 | `Alt` | `Option` | `Alt` | 使用 Electron Accelerator 自动适配 |
| 字体 | 微软雅黑 | PingFang SC | Noto Sans CJK | 按平台设置 fallback 字体链 |
| 滚动条 | 始终显示 | 自动隐藏 | 始终显示 | CSS 按平台适配 |

---

## 6. 测试策略

### 6.1 手动测试清单

```
□ 新建文件 → 编辑 → 保存 → 关闭 → 重新打开验证内容
□ 打开大文件（>1MB）检查编辑器响应
□ 在编辑器外部修改文件，切换回应用时提示
□ 侧边栏文件树中重命名文件，编辑器同步更新
□ 全局搜索关键词，验证结果数量和高亮
□ 导出 HTML，在浏览器中打开验证样式
□ 导出 PDF，检查分页和字体
□ 切换主题，检查所有 UI 区域颜色正确
□ 输入复杂 Markdown（嵌套标记、表格、公式、图表）
□ 快捷键逐个验证
□ 在 Windows / macOS 双平台验证
□ 长时间使用（>1小时）检查内存泄漏
```

### 6.2 边界情况测试

```
□ 空文件打开和编辑
□ 仅空格和空行的文件
□ 超长行（超过 1000 字符）
□ 大量连续空行
□ 深层嵌套列表（>5 层）
□ 文件路径含特殊字符（#、%、中文、空格）
□ 同时编辑同一文件的两个实例
□ 只读文件无法保存时的错误提示
□ 磁盘空间不足时的错误处理
□ 快速连续 Ctrl+S 保存的防抖
```

---

## 7. 组件与文件变更

| 文件路径 | 说明 |
|---------|------|
| `src/editor/wysiwyg-plugin.ts` | WYSIWYG 即时渲染插件（核心） |
| `src/styles/wysiwyg.css` | 即时渲染模式样式 |
| `src/editor/focus-mode.ts` | 专注模式实现 |
| `src/editor/typewriter-mode.ts` | 打字机模式实现 |
| `src/components/Editor/ModeSwitch.tsx` | 模式切换按钮 |
| `src/utils/performance.ts` | 防抖、节流通用工具 |
| `src/utils/sanitize.ts` | DOM 净化（XSS 防护） |
| `src/utils/dom-diff.ts` | 增量 DOM 更新 |
| `src/editor/large-file-handler.ts` | 大文件检测与降级方案 |

---

## 8. 验收标准

| 功能 | 验收条件 |
|------|---------|
| 即时渲染模式 | 在无光标处隐藏 `**`, `#`, `*` 等标记符，显示渲染效果 |
| 光标感知 | 光标移入标记符附近时显示源码标记 |
| 模式切换 | 可在双栏模式和即时渲染模式间任意切换 |
| 专注模式 | 非当前行半透明（可配置透明度） |
| 打字机模式 | 当前编辑行保持视口垂直居中 |
| 大文件 | 打开 5000+ 行文档无明显卡顿 |
| 搜索防抖 | 连续快速输入搜索关键词不触发频繁搜索 |
| XSS 防护 | 文档中嵌入 `<script>` 标签不执行 |
| 跨平台 | Windows/macOS/Linux 基本功能一致 |
| 内存 | 连续操作 1 小时后内存无明显增长 |

---

## 9. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| 即时渲染开发周期超预期 | 第六阶段延期 | 先实现最核心的加粗/斜体/标题，表格/代码块降级到双栏模式查看 |
| 浏览器重排性能瓶颈 | 专注模式卡顿 | 使用 `will-change`、`transform` 等硬件加速 CSS |
| 与 markdown-it 解析结果不一致 | 排版错乱 | 以 CM6 语法树为准，作为唯一的 truth source |
| 用户习惯双栏模式 | 即时渲染接受度低 | 保持两种模式可选，默认双栏 |
| 大文件虚拟滚动实现复杂 | 开发成本高 | CM6 自带 viewport 机制已能处理大部分情况，不额外实现 |

---

## 10. 后续展望

超出本阶段范围的潜在功能：

- **拼写检查**：集成 Electron 的 `spellcheck` 或 `node-spellchecker`
- **版本历史**：类似 Typora 的文档版本快照
- **图片拖拽上传**：集成图床（SM.MS、阿里云OSS等）
- **Git 集成**：在侧边栏显示 Git 状态
- **插件系统**：（参考 DevelopmentPlan.md 中的扩展设计）
- **协同编辑**：基于 WebSocket/Yjs 的实时协同
- **Vim 模式**：CM6 有现成的 vim 扩展
