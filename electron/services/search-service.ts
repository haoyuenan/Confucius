import fs from 'fs/promises'
import path from 'path'

export interface SearchResult {
  filePath: string
  fileName: string
  lineNumber: number
  lineContent: string
  matchStart: number
  matchEnd: number
}

export class SearchService {
  async search(
    rootPath: string,
    query: string,
    options?: {
      caseSensitive?: boolean
      regex?: boolean
      maxResults?: number
    },
  ): Promise<SearchResult[]> {
    const maxResults = options?.maxResults ?? 500
    const flags = options?.caseSensitive ? 'g' : 'gi'
    const pattern = options?.regex
      ? new RegExp(query, flags)
      : new RegExp(escapeRegex(query), flags)

    const files = await this.findMdFiles(rootPath)
    const results: SearchResult[] = []
    let stopped = false

    // 并发搜索：同时处理最多 8 个文件
    const CONCURRENCY = 8
    const searchInFile = async (filePath: string): Promise<void> => {
      if (stopped) return
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const lines = content.split('\n')
        const fileName = path.basename(filePath)
        for (let i = 0; i < lines.length; i++) {
          if (stopped) return
          const line = lines[i]
          pattern.lastIndex = 0
          let match: RegExpExecArray | null
          while ((match = pattern.exec(line)) !== null) {
            if (results.length >= maxResults) { stopped = true; return }
            results.push({
              filePath, fileName, lineNumber: i + 1, lineContent: line,
              matchStart: match.index, matchEnd: match.index + match[0].length,
            })
          }
        }
      } catch { /* 跳过无法读取的文件 */ }
    }

    // 按 CONCURRENCY 分批执行
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const batch = files.slice(i, i + CONCURRENCY)
      await Promise.all(batch.map(searchInFile))
      if (stopped) break
    }
    return results
  }

  private async findMdFiles(rootPath: string): Promise<string[]> {
    const result: string[] = []
    async function walk(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            await walk(fullPath)
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            result.push(fullPath)
          }
        }
      } catch { /* 权限不足时跳过 */ }
    }
    await walk(rootPath)
    return result
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
