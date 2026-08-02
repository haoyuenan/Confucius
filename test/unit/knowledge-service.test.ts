import { describe, it, expect } from 'vitest'
import {
  parseWikiLinks,
  parseTags,
  parseFrontmatter,
  extractTitle,
} from '../../src/services/knowledge-service'

describe('parseWikiLinks', () => {
  it('extracts simple wiki links', () => {
    expect(parseWikiLinks('参考[[我的想法]]和[[项目规划]]')).toEqual(['我的想法', '项目规划'])
  })

  it('extracts wiki links with display text', () => {
    expect(parseWikiLinks('参考[[我的想法|想法笔记]]')).toEqual(['我的想法'])
  })

  it('ignores links inside code blocks', () => {
    const content = '正文\n```\n[[忽略]]\n```\n后文[[保留]]'
    expect(parseWikiLinks(content)).toEqual(['保留'])
  })

  it('ignores links inside inline code', () => {
    const content = '正文 `[[忽略]]` 后文[[保留]]'
    expect(parseWikiLinks(content)).toEqual(['保留'])
  })

  it('deduplicates identical links', () => {
    expect(parseWikiLinks('[[笔记]][[笔记]]')).toEqual(['笔记'])
  })

  it('returns empty for content without links', () => {
    expect(parseWikiLinks('普通文本')).toEqual([])
  })
})

describe('parseTags', () => {
  it('extracts inline tags', () => {
    expect(parseTags('今天学到了 #前端 和 #工作/项目A')).toEqual(['前端', '工作/项目A'])
  })

  it('extracts tags from frontmatter', () => {
    const content = '---\ntitle: Test\ntags: [日记, 读书]\n---\n正文'
    expect(parseTags(content)).toContain('日记')
    expect(parseTags(content)).toContain('读书')
  })

  it('merges inline and frontmatter tags', () => {
    const content = '---\ntags: [工作]\n---\n今日 #学习'
    const tags = parseTags(content)
    expect(tags).toContain('工作')
    expect(tags).toContain('学习')
  })

  it('ignores tags in code blocks', () => {
    const content = '```\n#忽略\n```\n后文 #保留'
    expect(parseTags(content)).toEqual(['保留'])
  })

  it('handles Chinese tag characters', () => {
    expect(parseTags('#读书笔记 和 #项目/前端')).toContain('读书笔记')
    expect(parseTags('#读书笔记 和 #项目/前端')).toContain('项目/前端')
  })

  it('returns empty for content without tags', () => {
    expect(parseTags('普通文本')).toEqual([])
  })
})

describe('parseFrontmatter', () => {
  it('extracts title from frontmatter', () => {
    expect(parseFrontmatter('---\ntitle: 我的笔记\n---\n正文').title).toBe('我的笔记')
  })

  it('extracts created date from frontmatter', () => {
    expect(parseFrontmatter('---\ncreated: 2024-01-15\n---\n正文').created).toBe('2024-01-15')
  })

  it('returns empty for no frontmatter', () => {
    expect(parseFrontmatter('纯正文')).toEqual({})
  })

  it('handles quoted values', () => {
    expect(parseFrontmatter('---\ntitle: "我的笔记"\n---').title).toBe('我的笔记')
  })
})

describe('extractTitle', () => {
  it('prefers frontmatter title', () => {
    expect(extractTitle('/path/untitled.md', '---\ntitle: 我的笔记\n---\n# H1标题')).toBe('我的笔记')
  })

  it('falls back to H1', () => {
    expect(extractTitle('/path/file.md', '# 我的笔记\n正文')).toBe('我的笔记')
  })

  it('falls back to filename', () => {
    expect(extractTitle('/path/我的笔记.md', '正文')).toBe('我的笔记')
  })
})
