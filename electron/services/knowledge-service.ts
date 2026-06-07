import fs from 'fs'
import path from 'path'

export interface KnowledgeIndex {
  version: 1
  files: Record<string, FileMeta>
  links: Link[]
  tags: Record<string, string[]>
}

export interface FileMeta {
  path: string
  title: string
  links: string[]
  linkedFrom: string[]
  tags: string[]
  created: string
  modified: string
}

export interface Link {
  source: string
  target: string
  resolved: boolean
  targetPath?: string
}

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
  return {
    title: fm.title,
    created: fm.created,
  }
}

export function extractTitle(filePath: string, content: string): string {
  const fm = parseFrontmatter(content)
  if (fm.title) return fm.title
  const h1 = content.match(/^#\s+(.+)/m)
  if (h1) return h1[1].trim()
  return path.basename(filePath, '.md')
}

export class KnowledgeService {
  private index: KnowledgeIndex = { version: 1, files: {}, links: [], tags: {} }
  private workspacePath: string = ''
  private indexPath: string = ''
  private ready = false

  async initialize(workspacePath: string): Promise<void> {
    this.workspacePath = workspacePath
    this.indexPath = path.join(workspacePath, '.confucius', 'index.json')
    if (fs.existsSync(this.indexPath)) {
      const raw = fs.readFileSync(this.indexPath, 'utf-8')
      this.index = JSON.parse(raw)
      await this.syncChanges()
    } else {
      await this.fullScan()
    }
    this.ready = true
  }

  isReady(): boolean {
    return this.ready
  }

  async fullScan(): Promise<void> {
    this.index = { version: 1, files: {}, links: [], tags: {} }
    this.scanDirectory(this.workspacePath)
    this.resolveAllLinks()
    this.buildTagIndex()
    this.save()
  }

  private scanDirectory(dirPath: string): void {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        this.scanDirectory(fullPath)
      } else if (entry.name.endsWith('.md')) {
        this.indexFile(fullPath)
      }
    }
  }

  private indexFile(fullPath: string): void {
    let content: string
    try {
      content = fs.readFileSync(fullPath, 'utf-8')
    } catch {
      return
    }
    const relPath = path.relative(this.workspacePath, fullPath).replace(/\\/g, '/')
    const fm = parseFrontmatter(content)
    let stat: fs.Stats
    try {
      stat = fs.statSync(fullPath)
    } catch {
      return
    }
    const meta: FileMeta = {
      path: relPath,
      title: extractTitle(fullPath, content),
      links: parseWikiLinks(content),
      linkedFrom: [],
      tags: parseTags(content),
      created: fm.created || '',
      modified: stat.mtime.toISOString(),
    }
    this.index.files[relPath] = meta
  }

  private resolveAllLinks(): void {
    this.index.links = []
    const titleToPath: Record<string, string> = {}
    for (const [filePath, meta] of Object.entries(this.index.files)) {
      titleToPath[meta.title.toLowerCase()] = filePath
      const baseName = path.basename(filePath, '.md').toLowerCase()
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

  private save(): void {
    const dir = path.dirname(this.indexPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2), 'utf-8')
  }

  private async syncChanges(): Promise<void> {
    const knownPaths = new Set(Object.keys(this.index.files))
    const currentPaths = new Set<string>()
    this.collectFilePaths(this.workspacePath, currentPaths)
    for (const fp of currentPaths) {
      if (!knownPaths.has(fp)) {
        const fullPath = path.join(this.workspacePath, fp)
        await this.updateFile(fullPath)
      }
    }
    for (const fp of knownPaths) {
      if (!currentPaths.has(fp)) {
        const fullPath = path.join(this.workspacePath, fp)
        await this.updateFile(fullPath)
      }
    }
  }

  private collectFilePaths(dirPath: string, result: Set<string>): void {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dirPath, entry.name)
      const relPath = path.relative(this.workspacePath, fullPath).replace(/\\/g, '/')
      if (entry.isDirectory()) {
        this.collectFilePaths(fullPath, result)
      } else if (entry.name.endsWith('.md')) {
        result.add(relPath)
      }
    }
  }

  async updateFile(fullPath: string): Promise<void> {
    if (!this.ready) return
    const relPath = path.relative(this.workspacePath, fullPath).replace(/\\/g, '/')
    if (!fs.existsSync(fullPath)) {
      delete this.index.files[relPath]
      this.index.links = this.index.links.filter(l => l.source !== relPath)
      for (const meta of Object.values(this.index.files)) {
        meta.linkedFrom = meta.linkedFrom.filter(p => p !== relPath)
      }
    } else {
      if (!fullPath.endsWith('.md')) return
      this.indexFile(fullPath)
    }
    this.resolveAllLinks()
    this.buildTagIndex()
    this.save()
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    const oldRel = path.relative(this.workspacePath, oldPath).replace(/\\/g, '/')
    const newRel = path.relative(this.workspacePath, newPath).replace(/\\/g, '/')
    const meta = this.index.files[oldRel]
    if (meta) {
      meta.path = newRel
      this.index.files[newRel] = meta
      delete this.index.files[oldRel]
      for (const link of this.index.links) {
        if (link.source === oldRel) link.source = newRel
        if (link.targetPath === oldRel) { link.targetPath = newRel; link.resolved = true }
      }
      for (const m of Object.values(this.index.files)) {
        m.linkedFrom = m.linkedFrom.map(p => p === oldRel ? newRel : p)
      }
      this.save()
    }
  }

  getBacklinks(filePath: string): { linked: Link[]; unlinked: string[] } {
    const relPath = path.relative(this.workspacePath, filePath).replace(/\\/g, '/')
    const linked = this.index.links.filter(l => l.targetPath === relPath)
    return { linked, unlinked: [] }
  }

  getGraphData(filePath?: string): { nodes: string[]; links: Link[] } {
    if (filePath) {
      const relPath = path.relative(this.workspacePath, filePath).replace(/\\/g, '/')
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

  createDailyNote(): string {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const dirPath = path.join(this.workspacePath, '日记', String(y), m)
    const filePath = path.join(dirPath, `${y}-${m}-${d}.md`)
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
    if (!fs.existsSync(filePath)) {
      const content = `---\ntitle: ${y}-${m}-${d} 日记\ncreated: ${y}-${m}-${d}\ntags: [日记]\n---\n\n# ${y}-${m}-${d}\n\n`
      fs.writeFileSync(filePath, content, 'utf-8')
    }
    return filePath
  }

  notifyRename(oldPath: string, newPath: string): void {
    this.renameFile(oldPath, newPath)
  }
}

export const knowledgeService = new KnowledgeService()
