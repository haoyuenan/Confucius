import { describe, it, expect } from 'vitest'

describe('parseWikiLinks', () => {
  function parseWikiLinks(content: string): string[] {
    const cleaned = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')
    const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
    const links: string[] = []
    let match
    while ((match = regex.exec(cleaned)) !== null) {
      links.push(match[1].trim())
    }
    return [...new Set(links)]
  }

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
  function parseTags(content: string): string[] {
    const cleaned = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')
    const regex = /(?:^|\s)#([\w\u4e00-\u9fff\/\-]+)/g
    const tags: string[] = []
    let match
    while ((match = regex.exec(cleaned)) !== null) {
      const tag = match[1].trim()
      if (tag && !/^\d+$/.test(tag)) tags.push(tag)
    }
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (fmMatch) {
      const fm = fmMatch[1]
      const tagLine = fm.match(/^tags:\s*\[(.+?)\]/m)
      if (tagLine) {
        tagLine[1].split(',').map(t => t.trim()).forEach(t => tags.push(t))
      }
    }
    return [...new Set(tags)]
  }

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
  function parseFrontmatter(content: string): { title?: string; created?: string } {
    const match = content.match(/^---\n([\s\S]*?)\n---/)
    if (!match) return {}
    const fm: Record<string, string> = {}
    const lines = match[1].split('\n')
    for (const line of lines) {
      const [key, ...rest] = line.split(':')
      if (key && rest.length > 0) {
        fm[key.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '')
      }
    }
    return {
      title: fm.title,
      created: fm.created,
    }
  }

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
  function parseFrontmatter(content: string): { title?: string } {
    const match = content.match(/^---\n([\s\S]*?)\n---/)
    if (!match) return {}
    const fm: Record<string, string> = {}
    const lines = match[1].split('\n')
    for (const line of lines) {
      const [key, ...rest] = line.split(':')
      if (key && rest.length > 0) {
        fm[key.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '')
      }
    }
    return { title: fm.title }
  }

  function extractTitle(filePath: string, content: string): string {
    const fm = parseFrontmatter(content)
    if (fm.title) return fm.title
    const h1 = content.match(/^#\s+(.+)/m)
    if (h1) return h1[1].trim()
    return filePath.replace(/\.md$/, '').split(/[/\\]/).pop() || filePath
  }

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
