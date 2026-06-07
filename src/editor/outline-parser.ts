export interface OutlineItem {
  level: 1 | 2 | 3 | 4 | 5 | 6
  text: string
  from: number
  to: number
  slug: string
}

/**
 * 从 Markdown 文本中提取标题大纲
 */
import { slugify } from './markdown-renderer'

export function extractOutline(doc: string): OutlineItem[] {
  const lines = doc.split('\n')
  const items: OutlineItem[] = []
  let offset = 0

  const inCodeBlock = (lineIdx: number, lineArr: string[]): boolean => {
    let count = 0
    for (let j = 0; j <= lineIdx; j++) {
      if (/^```/.test(lineArr[j])) count++
    }
    return count % 2 === 1
  }

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/)
    if (match && !inCodeBlock(i, lines)) {
      const level = match[1].length as 1 | 2 | 3 | 4 | 5 | 6
      items.push({
        level,
        text: match[2].trim(),
        slug: slugify(match[2].trim()),
        from: offset,
        to: offset + lines[i].length,
      })
    }
    // +1 for the '\n' separator (except after last line)
    offset += lines[i].length + (i < lines.length - 1 ? 1 : 0)
  }

  return items
}

/**
 * 根据标题级别返回缩进像素值
 */
export function getOutlineIndent(level: number): number {
  return (level - 1) * 16
}
