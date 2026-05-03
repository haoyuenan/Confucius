/**
 * Phase05-1 WYSIWYG 即时渲染插件
 *
 * 工作原理：
 * 1. parseSyntaxMarkers() 扫描文档，用正则提取所有语法标记
 * 2. 长文档（>50000 字符）时仅在可见视口区域扫描以保持响应
 * 3. computeDecorations() 遍历标记 + 检测光标位置
 * 4. 光标远处→隐藏标记符；光标附近→灰色显示；内容→应用渲染样式
 */

import { Decoration, DecorationSet, EditorView, ViewPlugin, PluginValue, ViewUpdate } from '@codemirror/view'
import type { Range } from '@codemirror/state'

// ==================== 类型定义 ====================

enum MarkerType {
  Heading, Bold, Italic, Strikethrough, InlineCode, List, Quote,
}

interface SyntaxMarker {
  from: number
  to: number
  type: MarkerType
  role: 'open' | 'close' | 'content'
  level?: number
}

// 长文档阈值：超过此长度只扫描可视区域
const LARGE_DOC_THRESHOLD = 50000

// ==================== 标记解析器（支持范围裁剪）====================

function parseSyntaxMarkers(doc: string, rangeFrom?: number, rangeTo?: number): SyntaxMarker[] {
  const markers: SyntaxMarker[] = []
  const sliceStart = rangeFrom ?? 0
  const sliceEnd = rangeTo ?? doc.length
  // 只扫描指定范围的子串来提高大文档性能
  const slice = doc.slice(sliceStart, sliceEnd)
  const offset = sliceStart

  // 1. 标题
  const headingRe = /^(#{1,6})\s/gm
  let m: RegExpExecArray | null
  while ((m = headingRe.exec(slice)) !== null) {
    markers.push({
      from: offset + m.index,
      to: offset + m.index + m[0].length,
      type: MarkerType.Heading,
      role: 'open',
      level: m[1].length as 1 | 2 | 3 | 4 | 5 | 6,
    })
  }

  // 2. 加粗 **text**
  const boldRe = /\*\*(.+?)\*\*/gs
  while ((m = boldRe.exec(slice)) !== null) {
    markers.push(
      { from: offset + m.index, to: offset + m.index + 2, type: MarkerType.Bold, role: 'open' },
      { from: offset + m.index + 2, to: offset + m.index + m[0].length - 2, type: MarkerType.Bold, role: 'content' },
      { from: offset + m.index + m[0].length - 2, to: offset + m.index + m[0].length, type: MarkerType.Bold, role: 'close' },
    )
  }

  // 3. 斜体
  const italicRe = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g
  while ((m = italicRe.exec(slice)) !== null) {
    markers.push(
      { from: offset + m.index, to: offset + m.index + 1, type: MarkerType.Italic, role: 'open' },
      { from: offset + m.index + 1, to: offset + m.index + m[0].length - 1, type: MarkerType.Italic, role: 'content' },
      { from: offset + m.index + m[0].length - 1, to: offset + m.index + m[0].length, type: MarkerType.Italic, role: 'close' },
    )
  }

  // 4. 删除线
  const strikeRe = /~~(.+?)~~/g
  while ((m = strikeRe.exec(slice)) !== null) {
    markers.push(
      { from: offset + m.index, to: offset + m.index + 2, type: MarkerType.Strikethrough, role: 'open' },
      { from: offset + m.index + 2, to: offset + m.index + m[0].length - 2, type: MarkerType.Strikethrough, role: 'content' },
      { from: offset + m.index + m[0].length - 2, to: offset + m.index + m[0].length, type: MarkerType.Strikethrough, role: 'close' },
    )
  }

  // 5. 行内代码
  const codeRe = /`([^`]+)`/g
  while ((m = codeRe.exec(slice)) !== null) {
    markers.push(
      { from: offset + m.index, to: offset + m.index + 1, type: MarkerType.InlineCode, role: 'open' },
      { from: offset + m.index + 1, to: offset + m.index + m[0].length - 1, type: MarkerType.InlineCode, role: 'content' },
      { from: offset + m.index + m[0].length - 1, to: offset + m.index + m[0].length, type: MarkerType.InlineCode, role: 'close' },
    )
  }

  // 6. 无序列表 / 引用
  const lineStartRe = /^([-*>])\s/gm
  while ((m = lineStartRe.exec(slice)) !== null) {
    const type = m[1] === '>' ? MarkerType.Quote : MarkerType.List
    markers.push({
      from: offset + m.index,
      to: offset + m.index + m[0].length,
      type,
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

function hideMarker(): Decoration {
  return Decoration.mark({ class: 'cm-syntax-marker-hidden', inclusive: false })
}

function showMarkerDim(): Decoration {
  return Decoration.mark({ class: 'cm-syntax-marker' })
}

function contentStyle(type: MarkerType, level?: number): Decoration {
  switch (type) {
    case MarkerType.Heading: return Decoration.mark({ class: `cm-heading cm-heading-h${level || 1}` })
    case MarkerType.Bold: return Decoration.mark({ class: 'cm-bold' })
    case MarkerType.Italic: return Decoration.mark({ class: 'cm-italic' })
    case MarkerType.Strikethrough: return Decoration.mark({ class: 'cm-strikethrough' })
    case MarkerType.InlineCode: return Decoration.mark({ class: 'cm-inline-code' })
    default: return Decoration.mark({})
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
    const doc = view.state.doc
    const docLen = doc.length
    const cursorPos = view.state.selection.main.head

    // 大文档仅在可见视口 + 光标区域扫描
    let rangeFrom = 0
    let rangeTo = docLen
    if (docLen > LARGE_DOC_THRESHOLD) {
      const vp = view.viewport
      // 以视口为中心，上下各扩展 1000 字符作为缓冲区
      rangeFrom = Math.max(0, vp.from - 1000)
      rangeTo = Math.min(docLen, vp.to + 1000)
    }

    const docStr = doc.toString()
    const markers = parseSyntaxMarkers(docStr, rangeFrom, rangeTo)
    const decos: Range<Decoration>[] = []

    for (const marker of markers) {
      if (marker.role === 'open' || marker.role === 'close') {
        if (isMarkerNearCursor(marker.from, marker.to, cursorPos)) {
          decos.push(showMarkerDim().range(marker.from, marker.to))
        } else {
          decos.push(hideMarker().range(marker.from, marker.to))
        }
      } else {
        decos.push(contentStyle(marker.type, marker.level).range(marker.from, marker.to))
      }
    }

    return Decoration.set(decos, true)
  }

  destroy() {}
}

/** 导出 CM6 扩展 */
export function wysiwygMode() {
  return ViewPlugin.fromClass(WysiwygPlugin, {
    decorations: (v) => v.decorations,
  })
}
