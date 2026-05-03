export interface OutlineItem {
  level: 1 | 2 | 3 | 4 | 5 | 6
  text: string
  from: number
  to: number
}

/**
 * 从 Markdown 文本中提取标题大纲
 */
export function extractOutline(doc: string): OutlineItem[] {
  const lines = doc.split('\n')
  const items: OutlineItem[] = []

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      const level = match[1].length as 1 | 2 | 3 | 4 | 5 | 6
      const lineStartOffset = lines.slice(0, i).join('\n').length
      const lineEndOffset = lineStartOffset + lines[i].length
      items.push({
        level,
        text: match[2].trim(),
        from: lineStartOffset,
        to: lineEndOffset,
      })
    }
  }

  return items
}

/**
 * 根据标题级别返回缩进像素值
 */
export function getOutlineIndent(level: number): number {
  return (level - 1) * 16
}
