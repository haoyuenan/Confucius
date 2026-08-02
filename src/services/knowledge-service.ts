/**
 * 知识库索引服务（前端版）
 *
 * 使用 Rust commands 替代 Node.js fs 模块。
 * 解析 wikilinks、tags、YAML frontmatter，维护反向链接索引。
 */

import { readFileRaw, writeFile as bridgeWriteFile, fileExists as bridgeFileExists, readDir as bridgeReadDir, statFile as bridgeStatFile, createDir, renameItem } from './bridge'

// ── Types ──

interface FileMeta {
  path: string
  title: string
  links: string[]
  linkedFrom: string[]
  tags: string[]
  created: string
  modified: string
}

interface Link {
  source: string
  target: string
  resolved: boolean
  targetPath?: string
}

interface KnowledgeIndex {
  version: 1
  files: Record<string, FileMeta>
  links: Link[]
  tags: Record<string, string[]>
}

// ── Parsers ──

export function parseWikiLinks(content: string): string[] {
  const cleaned = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
  const links: string[] = []
  let match
  while ((match = regex.exec(cleaned)) !== null) {
    links.push(match[1].trim())
  }
  return [...new Set(links)]
}

export function parseTags(content: string): string[] {
  const cleaned = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')
  const regex = /(?:^|\s)#([\w\u4e00-\u9fff/-]+)/g
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

export function parseFrontmatter(content: string): { title?: string; created?: string } {
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
  return { title: fm.title, created: fm.created }
}

export function extractTitle(filePath: string, content: string): string {
  const fm = parseFrontmatter(content)
  if (fm.title) return fm.title
  const h1 = content.match(/^#\s+(.+)/m)
  if (h1) return h1[1].trim()
  return basename(filePath, '.md')
}

// ── Simple path utils (browser-compatible, forward-slash only) ──

function basename(p: string, ext?: string): string {
  const parts = p.replace(/\\/g, '/').split('/')
  let name = parts[parts.length - 1] || ''
  if (ext && name.endsWith(ext)) name = name.slice(0, -ext.length)
  return name
}

function dirname(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/')
  parts.pop()
  return parts.join('/') || '.'
}

function join(...parts: string[]): string {
  return parts.map((p, i) => {
    if (i === 0) return p.replace(/\\/g, '/').replace(/\/+$/, '')
    return p.replace(/\\/g, '/').replace(/^\//, '')
  }).join('/')
}

function relative(from: string, to: string): string {
  const fParts = from.replace(/\\/g, '/').split('/').filter(Boolean)
  const tParts = to.replace(/\\/g, '/').split('/').filter(Boolean)

  // Find common prefix
  let i = 0
  while (i < fParts.length && i < tParts.length && fParts[i] === tParts[i]) i++

  const up = fParts.slice(i).map(() => '..')
  const down = tParts.slice(i)
  return [...up, ...down].join('/') || '.'
}

// ── File I/O helpers (wrap Rust commands) ──

async function readFileBytes(path: string): Promise<string> {
  return readFileRaw(path)
}

async function writeFile(path: string, content: string): Promise<void> {
  return bridgeWriteFile(path, content)
}

async function fileExists(path: string): Promise<boolean> {
  return bridgeFileExists(path)
}

async function readDir(path: string): Promise<{ name: string; is_directory: boolean }[]> {
  return bridgeReadDir(path)
}

async function mkdir(path: string): Promise<void> {
  const parent = dirname(path)
  const name = basename(path)
  if (name) {
    // Use bridge's create_dir: parentPath + dirName
    await createDir(parent, name)
  }
}

async function statFile(path: string): Promise<{ size: number; modified: string; is_dir: boolean }> {
  return bridgeStatFile(path)
}

// ── Knowledge Service ──

export class KnowledgeService {
  private index: KnowledgeIndex = { version: 1, files: {}, links: [], tags: {} }
  private workspacePath: string = ''
  private indexPath: string = ''
  private ready = false

  async initialize(workspacePath: string): Promise<boolean> {
    this.workspacePath = workspacePath.replace(/\\/g, '/')
    this.indexPath = join(workspacePath, '.confucius', 'index.json')

    const exists = await fileExists(this.indexPath)
    if (exists) {
      try {
        const text = await readFileBytes(this.indexPath)
        this.index = JSON.parse(text)
        // 先置 ready 再同步增量，否则 syncChanges 调用的 updateFile 会被门禁跳过
        this.ready = true
        await this.syncChanges()
      } catch {
        await this.fullScan()
      }
    } else {
      await this.fullScan()
    }
    this.ready = true
    return true
  }

  isReady(): boolean {
    return this.ready
  }

  async fullScan(): Promise<void> {
    this.index = { version: 1, files: {}, links: [], tags: {} }
    await this.scanDirectory(this.workspacePath)
    this.resolveAllLinks()
    this.buildTagIndex()
    await this.save()
  }

  private async scanDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await readDir(dirPath)
      for (const entry of entries) {
        const name = entry.name
        if (name.startsWith('.')) continue
        const fullPath = join(dirPath, name)
        if (entry.is_directory) {
          await this.scanDirectory(fullPath)
        } else if (name.endsWith('.md') || name.endsWith('.markdown')) {
          await this.indexFile(fullPath)
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  private async indexFile(fullPath: string): Promise<void> {
    let content: string
    try {
      content = await readFileBytes(fullPath)
    } catch {
      return
    }
    const relPath = relative(this.workspacePath, fullPath)
    const fm = parseFrontmatter(content)
    let modified = ''
    try {
      const stat = await statFile(fullPath)
      modified = stat.modified || new Date().toISOString()
    } catch {
      modified = new Date().toISOString()
    }
    const meta: FileMeta = {
      path: relPath,
      title: extractTitle(fullPath, content),
      links: parseWikiLinks(content),
      linkedFrom: [],
      tags: parseTags(content),
      created: fm.created || '',
      modified,
    }
    this.index.files[relPath] = meta
  }

  private resolveAllLinks(): void {
    this.index.links = []
    const titleToPath: Record<string, string> = {}
    for (const [filePath, meta] of Object.entries(this.index.files)) {
      // 与 Rust 引擎的 or_insert 语义一致：先写保留，后写不覆盖
      const titleKey = meta.title.toLowerCase()
      if (!titleToPath[titleKey]) titleToPath[titleKey] = filePath
      const baseName = basename(filePath, '.md').toLowerCase()
      if (!titleToPath[baseName]) titleToPath[baseName] = filePath
    }
    for (const meta of Object.values(this.index.files)) {
      meta.linkedFrom = []
    }
    for (const [filePath, meta] of Object.entries(this.index.files)) {
      for (const targetTitle of meta.links) {
        const targetPath = titleToPath[targetTitle.toLowerCase()]
        this.index.links.push({
          source: filePath,
          target: targetTitle,
          resolved: !!targetPath,
          targetPath: targetPath || undefined,
        })
        if (targetPath) {
          const targetMeta = this.index.files[targetPath]
          if (targetMeta && !targetMeta.linkedFrom.includes(filePath)) {
            targetMeta.linkedFrom.push(filePath)
          }
        }
      }
    }
  }

  private buildTagIndex(): void {
    this.index.tags = {}
    for (const [filePath, meta] of Object.entries(this.index.files)) {
      for (const tag of meta.tags) {
        if (!this.index.tags[tag]) this.index.tags[tag] = []
        this.index.tags[tag].push(filePath)
      }
    }
  }

  private async save(): Promise<void> {
    const dir = dirname(this.indexPath)
    try {
      await mkdir(dir)
    } catch {
      // Directory may already exist
    }
    const json = JSON.stringify(this.index, null, 2)
    // 原子写：先写临时文件再 rename 替换，避免写盘中断损坏索引
    const tmpPath = `${this.indexPath}.tmp`
    try {
      await writeFile(tmpPath, json)
      await renameItem(tmpPath, basename(this.indexPath))
    } catch {
      // rename 异常环境（如跨设备）时退回直接写
      await writeFile(this.indexPath, json)
    }
  }

  private async syncChanges(): Promise<void> {
    const knownPaths = new Set(Object.keys(this.index.files))
    const currentPaths = new Set<string>()
    await this.collectFilePaths(this.workspacePath, currentPaths)
    for (const fp of currentPaths) {
      if (!knownPaths.has(fp)) {
        const fullPath = join(this.workspacePath, fp)
        await this.updateFile(fullPath)
      }
    }
    for (const fp of knownPaths) {
      if (!currentPaths.has(fp)) {
        const fullPath = join(this.workspacePath, fp)
        await this.updateFile(fullPath)
      }
    }
  }

  private async collectFilePaths(dirPath: string, result: Set<string>): Promise<void> {
    try {
      const entries = await readDir(dirPath)
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const fullPath = join(dirPath, entry.name)
        const relPath = relative(this.workspacePath, fullPath)
        if (entry.is_directory) {
          await this.collectFilePaths(fullPath, result)
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.markdown')) {
          result.add(relPath)
        }
      }
    } catch {
      // Skip
    }
  }

  async updateFile(fullPath: string): Promise<void> {
    if (!this.ready) return
    const relPath = relative(this.workspacePath, fullPath)
    const exists = await fileExists(fullPath)
    if (exists) {
      if (!fullPath.endsWith('.md') && !fullPath.endsWith('.markdown')) return
      await this.indexFile(fullPath)
    } else {
      // File doesn't exist, remove from index
      delete this.index.files[relPath]
      this.index.links = this.index.links.filter(l => l.source !== relPath)
      for (const meta of Object.values(this.index.files)) {
        meta.linkedFrom = meta.linkedFrom.filter(p => p !== relPath)
      }
    }
    this.resolveAllLinks()
    this.buildTagIndex()
    await this.save()
  }

  async reindex(filePath: string): Promise<boolean> {
    await this.updateFile(filePath)
    return true
  }

  getBacklinks(filePath: string): { linked: Link[]; unlinked: string[] } {
    const relPath = relative(this.workspacePath, filePath)
    const linked = this.index.links.filter(l => l.targetPath === relPath)
    return { linked, unlinked: [] }
  }

  getGraphData(filePath?: string): { nodes: string[]; links: Link[] } {
    if (filePath) {
      const relPath = relative(this.workspacePath, filePath)
      const connected = new Set<string>([relPath])
      const filteredLinks = this.index.links.filter(l => l.source === relPath || l.targetPath === relPath)
      for (const l of filteredLinks) {
        connected.add(l.source)
        if (l.targetPath) connected.add(l.targetPath)
      }
      return { nodes: [...connected], links: filteredLinks }
    }
    return {
      nodes: Object.keys(this.index.files),
      links: this.index.links,
    }
  }

  getTags(): Record<string, string[]> {
    return { ...this.index.tags }
  }

  searchFiles(query: string, maxResults = 20): { path: string; title: string; mtime: string }[] {
    const lower = query.toLowerCase()
    const results: { path: string; title: string; mtime: string }[] = []
    for (const [fp, meta] of Object.entries(this.index.files)) {
      if (fp.toLowerCase().includes(lower) || meta.title.toLowerCase().includes(lower)) {
        results.push({ path: fp, title: meta.title, mtime: meta.modified })
      }
    }
    return results.sort((a, b) => a.path.localeCompare(b.path)).slice(0, maxResults)
  }

  resolveLink(linkTitle: string): string | null {
    const titleLower = linkTitle.toLowerCase()
    for (const [, meta] of Object.entries(this.index.files)) {
      if (meta.title.toLowerCase() === titleLower) return meta.path
    }
    for (const [, meta] of Object.entries(this.index.files)) {
      if (meta.title.toLowerCase().includes(titleLower)) return meta.path
    }
    return null
  }

  async createDailyNote(): Promise<string> {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const dirPath = join(this.workspacePath, '日记', String(y), m)
    const filePath = join(dirPath, `${y}-${m}-${d}.md`)

    try {
      await mkdir(dirPath)
    } catch {
      // Already exists
    }

    const exists = await fileExists(filePath)
    if (!exists) {
      const content = `---\ntitle: ${y}-${m}-${d} 日记\ncreated: ${y}-${m}-${d}\ntags: [日记]\n---\n\n# ${y}-${m}-${d}\n\n`
      await writeFile(filePath, content)
    }

    return filePath
  }
}
