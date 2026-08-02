import { describe, test, expect } from 'vitest'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import * as fmt from '../../../src/editor/format-helpers'

function createView(doc: string): EditorView {
  return new EditorView({ state: EditorState.create({ doc }) })
}

describe('format-helpers', () => {
  describe('insertHeading', () => {
    test('H1 在行首插入 # ', () => {
      const view = createView('hello')
      fmt.insertHeading(view, 1)
      expect(view.state.doc.toString()).toBe('# hello')
    })
    test('H2 在行首插入 ## ', () => {
      const view = createView('hello')
      fmt.insertHeading(view, 2)
      expect(view.state.doc.toString()).toBe('## hello')
    })
    test('替换已有标题标记', () => {
      const view = createView('## hello')
      view.dispatch({ selection: { anchor: 3 } })
      fmt.insertHeading(view, 3)
      expect(view.state.doc.toString()).toBe('### hello')
    })
  })

  describe('toggleBold', () => {
    test('包裹选中文本', () => {
      const view = createView('hello world')
      view.dispatch({ selection: { anchor: 0, head: 5 } })
      fmt.toggleBold(view)
      expect(view.state.doc.toString()).toBe('**hello** world')
    })
    test('去除已有加粗', () => {
      const view = createView('**hello** world')
      view.dispatch({ selection: { anchor: 0, head: 9 } }) // **hello** = 9 chars
      fmt.toggleBold(view)
      expect(view.state.doc.toString()).toBe('hello world')
    })
    test('无选中时在光标处插入占位符', () => {
      const view = createView('text')
      view.dispatch({ selection: { anchor: 2 } }) // 光标在中间
      fmt.toggleBold(view)
      expect(view.state.doc.toString()).toContain('**粗体**')
    })
  })

  describe('toggleItalic', () => {
    test('包裹选中文本', () => {
      const view = createView('hello')
      view.dispatch({ selection: { anchor: 0, head: 5 } })
      fmt.toggleItalic(view)
      expect(view.state.doc.toString()).toBe('*hello*')
    })
    test('去除已有斜体', () => {
      const view = createView('*hello* world')
      view.dispatch({ selection: { anchor: 0, head: 7 } })
      fmt.toggleItalic(view)
      expect(view.state.doc.toString()).toBe('hello world')
    })
  })

  describe('toggleStrikethrough', () => {
    test('包裹选中文本', () => {
      const view = createView('hello')
      view.dispatch({ selection: { anchor: 0, head: 5 } })
      fmt.toggleStrikethrough(view)
      expect(view.state.doc.toString()).toBe('~~hello~~')
    })
    test('去除已有删除线', () => {
      const view = createView('~~hello~~')
      view.dispatch({ selection: { anchor: 0, head: 9 } })
      fmt.toggleStrikethrough(view)
      expect(view.state.doc.toString()).toBe('hello')
    })
  })

  describe('toggleBlockquote', () => {
    test('为选中行添加 > 前缀', () => {
      const view = createView('line1\nline2')
      view.dispatch({ selection: { anchor: 0, head: 11 } })
      fmt.toggleBlockquote(view)
      expect(view.state.doc.toString()).toBe('> line1\n> line2')
    })
    test('去除已有 > 前缀', () => {
      const view = createView('> line1\n> line2')
      view.dispatch({ selection: { anchor: 0, head: 15 } })
      fmt.toggleBlockquote(view)
      expect(view.state.doc.toString()).toBe('line1\nline2')
    })
  })

  describe('insertCodeBlock', () => {
    test('无选中时插入空代码块', () => {
      const view = createView('')
      fmt.insertCodeBlock(view)
      expect(view.state.doc.toString()).toBe('```\n\n```')
    })
    test('选中文本时包裹代码块', () => {
      const view = createView('const x = 1')
      view.dispatch({ selection: { anchor: 0, head: 11 } })
      fmt.insertCodeBlock(view)
      expect(view.state.doc.toString()).toBe('```\nconst x = 1\n```')
    })
  })

  describe('toggleInlineCode', () => {
    test('包裹选中文本', () => {
      const view = createView('hello')
      view.dispatch({ selection: { anchor: 0, head: 5 } })
      fmt.toggleInlineCode(view)
      expect(view.state.doc.toString()).toBe('`hello`')
    })
  })

  describe('insertUnorderedList', () => {
    test('为选中行添加 - 前缀', () => {
      const view = createView('a\nb')
      view.dispatch({ selection: { anchor: 0, head: 3 } })
      fmt.insertUnorderedList(view)
      expect(view.state.doc.toString()).toBe('- a\n- b')
    })
  })

  describe('insertOrderedList', () => {
    test('为选中行添加 1. 2. 前缀', () => {
      const view = createView('a\nb')
      view.dispatch({ selection: { anchor: 0, head: 3 } })
      fmt.insertOrderedList(view)
      expect(view.state.doc.toString()).toBe('1. a\n2. b')
    })
  })

  describe('insertLink', () => {
    test('插入链接并选中 url', () => {
      const view = createView('click here')
      view.dispatch({ selection: { anchor: 0, head: 10 } })
      fmt.insertLink(view)
      const doc = view.state.doc.toString()
      expect(doc).toBe('[click here](url)')
      const sel = view.state.selection.main
      expect(sel.from).toBe(13)
      expect(sel.to).toBe(16)
    })
    test('无选中时使用占位符', () => {
      const view = createView('')
      fmt.insertLink(view)
      expect(view.state.doc.toString()).toBe('[链接文本](url)')
    })
  })

  describe('insertImage', () => {
    test('插入图片语法', () => {
      const view = createView('')
      fmt.insertImage(view)
      expect(view.state.doc.toString()).toBe('![图片描述](url)')
    })

    test('光标选中 url 部分而非硬编码偏移', () => {
      const view = createView('')
      fmt.insertImage(view)
      const { from, to } = view.state.selection.main
      // `![图片描述](url)`：'图片描述' 4 字符，url 起点 = 4 + 4
      expect(view.state.doc.sliceString(from, to)).toBe('url')
    })
  })

  describe('insertHorizontalRule', () => {
    test('在行首插入 ---', () => {
      const view = createView('text')
      fmt.insertHorizontalRule(view)
      expect(view.state.doc.toString()).toBe('---\ntext')
    })
  })

  describe('insertMathBlock', () => {
    test('无选中时插入空公式块', () => {
      const view = createView('')
      fmt.insertMathBlock(view)
      expect(view.state.doc.toString()).toBe('$$\n\n$$')
    })
    test('选中文本时包裹公式块', () => {
      const view = createView('E=mc^2')
      view.dispatch({ selection: { anchor: 0, head: 6 } })
      fmt.insertMathBlock(view)
      expect(view.state.doc.toString()).toBe('$$\nE=mc^2\n$$')
    })
  })

  describe('wrapSelectionAsLink', () => {
    test('选中文本 + URL → 插入 Markdown 链接', () => {
      const view = createView('my link')
      view.dispatch({ selection: { anchor: 0, head: 7 } })
      const result = fmt.wrapSelectionAsLink(view, 'https://example.com')
      expect(result).toBe(true)
      expect(view.state.doc.toString()).toBe('[my link](https://example.com)')
    })
    test('选中图片扩展名 + 图片 URL → 插入 Markdown 图片', () => {
      const view = createView('screenshot')
      view.dispatch({ selection: { anchor: 0, head: 10 } })
      const result = fmt.wrapSelectionAsLink(view, 'https://example.com/photo.png')
      expect(result).toBe(true)
      expect(view.state.doc.toString()).toBe('![screenshot](https://example.com/photo.png)')
    })
    test('选区等于 URL 时返回 false 不插入', () => {
      const view = createView('abc https://example.com xyz')
      const start = 'abc '.length
      const end = start + 'https://example.com'.length // 4 + 19 = 23
      view.dispatch({ selection: { anchor: start, head: end } })
      const result = fmt.wrapSelectionAsLink(view, 'https://example.com')
      expect(result).toBe(false)
      expect(view.state.doc.toString()).toBe('abc https://example.com xyz')
    })
    test('无选区时返回 false', () => {
      const view = createView('some text')
      const result = fmt.wrapSelectionAsLink(view, 'https://example.com')
      expect(result).toBe(false)
      expect(view.state.doc.toString()).toBe('some text')
    })
  })

  describe('insertImageFromPath', () => {
    test('插入图片语法', () => {
      const view = createView('')
      fmt.insertImageFromPath(view, '/path/to/image.png', 'image.png')
      expect(view.state.doc.toString()).toBe('![image](/path/to/image.png)')
    })
    test('Windows 反斜杠路径被转换为正斜杠', () => {
      const view = createView('')
      fmt.insertImageFromPath(view, 'C:\\Users\\test\\photo.jpg', 'photo.jpg')
      expect(view.state.doc.toString()).toBe('![photo](C:/Users/test/photo.jpg)')
    })
    test('文件名不含扩展名的中文名', () => {
      const view = createView('')
      fmt.insertImageFromPath(view, '/data/截图.png', '截图.png')
      expect(view.state.doc.toString()).toBe('![截图](/data/截图.png)')
    })
    test('光标位置插入', () => {
      const view = createView('prefix ')
      view.dispatch({ selection: { anchor: 7 } })
      fmt.insertImageFromPath(view, '/img/fig.svg', 'fig.svg')
      expect(view.state.doc.toString()).toBe('prefix ![fig](/img/fig.svg)')
    })
  })

  describe('insertTable', () => {
    test('插入 2×2 表格', () => {
      const view = createView('')
      fmt.insertTable(view, 2, 2)
      const doc = view.state.doc.toString()
      expect(doc).toContain('| Header 1')
      expect(doc).toContain('| Header 2')
      expect(doc).toContain('| ---')
      expect(doc).toContain('| Cell')
      // 两行表格 + 分隔行
      const lines = doc.split('\n').filter(Boolean)
      expect(lines.length).toBeGreaterThanOrEqual(3)
    })
    test('插入 3×4 表格', () => {
      const view = createView('')
      fmt.insertTable(view, 3, 4)
      const doc = view.state.doc.toString()
      // 应有 4 列
      expect(doc.match(/\| Header 4/g)).toBeTruthy()
      // 应有 3 行数据 + 1 行表头 + 1 行分隔
      const dataRows = doc.split('\n').filter(l => l.includes('Cell'))
      expect(dataRows.length).toBe(3)
    })
    test('返回 true', () => {
      const view = createView('')
      const result = fmt.insertTable(view, 1, 1)
      expect(result).toBe(true)
    })
  })
})
