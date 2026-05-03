/**
 * Phase05-1 WYSIWYG 即时渲染插件
 *
 * 工作原理：
 * 1. parseSyntaxMarkers() 扫描文档全文，用正则提取所有语法标记
 * 2. computeDecorations() 遍历标记 + 检测光标位置
 * 3. 光标远处→隐藏标记符 (width:0, opacity:0)
 * 4. 光标附近→灰色显示标记符
 * 5. 标记间内容→应用渲染样式（加粗/标题/斜体等）
 */

import { Decoration, DecorationSet, EditorView, ViewPlugin, PluginValue, ViewUpdate } from '@codemirror/view'
import type { Range } from '@codemirror/state'

// ==================== 类型定义 ====================

enum MarkerType {
  Heading,
  Bold,
  Italic,
  Strikethrough,
  InlineCode,
  List,
  Quote,
}

interface SyntaxMarker {
  from: number
  to: number
  type: MarkerType
  role: 'open' | 'close' | 'content'
  level?: number
}

// ==================== 标记解析器 ====================

function parseSyntaxMarkers(doc: string): SyntaxMarker[] {
  const markers: SyntaxMarker[] = []

  // 1. 标题 # ~ ######
  const headingRe = /^(#{1,6})\s/gm
  let m: RegExpExecArray | null
  while ((m = headingRe.exec(doc)) !== null) {
    markers.push({
      from: m.index,
      to: m.index + m[0].length,
      type: MarkerType.Heading,
      role: 'open',
      level: m[1].length as 1 | 2 | 3 | 4 | 5 | 6,
    })
  }

  // 2. 加粗 **text**
  const boldRe = /\*\*(.+?)\*\*/gs
  while ((m = boldRe.exec(doc)) !== null) {
    markers.push(
      { from: m.index, to: m.index + 2, type: MarkerType.Bold, role: 'open' },
      { from: m.index + 2, to: m.index + m[0].length - 2, type: MarkerType.Bold, role: 'content' },
      { from: m.index + m[0].length - 2, to: m.index + m[0].length, type: MarkerType.Bold, role: 'close' },
    )
  }

  // 3. 斜体 *text*（排除 ** 边界）
  const italicRe = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g
  while ((m = italicRe.exec(doc)) !== null) {
    markers.push(
      { from: m.index, to: m.index + 1, type: MarkerType.Italic, role: 'open' },
      { from: m.index + 1, to: m.index + m[0].length - 1, type: MarkerType.Italic, role: 'content' },
      { from: m.index + m[0].length - 1, to: m.index + m[0].length, type: MarkerType.Italic, role: 'close' },
    )
  }

  // 4. 删除线 ~~text~~
  const strikeRe = /~~(.+?)~~/g
  while ((m = strikeRe.exec(doc)) !== null) {
    markers.push(
      { from: m.index, to: m.index + 2, type: MarkerType.Strikethrough, role: 'open' },
      { from: m.index + 2, to: m.index + m[0].length - 2, type: MarkerType.Strikethrough, role: 'content' },
      { from: m.index + m[0].length - 2, to: m.index + m[0].length, type: MarkerType.Strikethrough, role: 'close' },
    )
  }

  // 5. 行内代码 `code`
  const codeRe = /`([^`]+)`/g
  while ((m = codeRe.exec(doc)) !== null) {
    markers.push(
      { from: m.index, to: m.index + 1, type: MarkerType.InlineCode, role: 'open' },
      { from: m.index + 1, to: m.index + m[0].length - 1, type: MarkerType.InlineCode, role: 'content' },
      { from: m.index + m[0].length - 1, to: m.index + m[0].length, type: MarkerType.InlineCode, role: 'close' },
    )
  }

  // 6. 无序列表 "- "（行首）
  const listRe = /^([-*])\s/gm
  while ((m = listRe.exec(doc)) !== null) {
    markers.push({
      from: m.index,
      to: m.index + m[0].length,
      type: MarkerType.List,
      role: 'open',
    })
  }

  // 7. 引用 "> "（行首）
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

// ==================== 光标距离判断 ====================

const PROXIMITY_THRESHOLD = 3

function isMarkerNearCursor(markerFrom: number, markerTo: number, cursorPos: number): boolean {
  return (
    Math.abs(markerFrom - cursorPos) < PROXIMITY_THRESHOLD ||
    Math.abs(markerTo - cursorPos) < PROXIMITY_THRESHOLD
  )
}

// ==================== Decoration 工厂 ====================

/** 隐藏语法标记（默认状态） */
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

/** 内容区域渲染样式 */
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
    default:
      return Decoration.mark({})
  }
}

// ==================== 插件主体 ====================

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
    const decos: Range<Decoration>[] = []

    for (const marker of markers) {
      if (marker.role === 'open' || marker.role === 'close') {
        // 语法标记：根据光标位置决定隐藏或显示
        if (isMarkerNearCursor(marker.from, marker.to, cursorPos)) {
          decos.push(showMarkerDim().range(marker.from, marker.to))
        } else {
          decos.push(hideMarker().range(marker.from, marker.to))
        }
      } else {
        // 内容区域：始终应用渲染样式
        decos.push(contentStyle(marker.type, marker.level).range(marker.from, marker.to))
      }
    }

    return Decoration.set(decos, true)
  }

  destroy() {
    // 无需清理
  }
}

/** 导出 CM6 扩展 */
export function wysiwygMode() {
  return ViewPlugin.fromClass(WysiwygPlugin, {
    decorations: (v) => v.decorations,
  })
}
