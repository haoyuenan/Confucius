import type { CommandDef } from '../types/plugin'

// ── Types ──

export interface PaletteCommand extends CommandDef {
  category: string
}

export interface CommandContext {
  newUntitledTab: () => void
  openFile: () => void
  saveFile: () => void
  saveAs: () => void
  toggleSidebar: () => void
  toggleMode: () => void
  togglePreview: () => void
  toggleFocus: () => void
  toggleTypewriter: () => void
  toggleTheme: () => void
  openSettings: (tab?: string) => void
  exportHtml: () => void
  exportPdf: () => void
  search: () => void
  findInDocument: () => void
}

// ── Recent commands (LRU, localStorage) ──

const RECENT_KEY = 'confucius-palette-recent'
const MAX_RECENT = 5

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveRecent(id: string): void {
  const recent = loadRecent().filter((x) => x !== id)
  recent.unshift(id)
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
}

export function getRecentCommands(all: PaletteCommand[]): PaletteCommand[] {
  const ids = loadRecent()
  const map = new Map(all.map((c) => [c.id, c]))
  return ids.map((id) => map.get(id)).filter((c): c is PaletteCommand => !!c)
}

// ── Built-in commands ──

export function getBuiltinCommands(ctx: CommandContext): PaletteCommand[] {
  return [
    { id: 'file:new', label: '新建文件', category: '文件', shortcut: 'Ctrl+N',
      execute: () => ctx.newUntitledTab() },
    { id: 'file:open', label: '打开文件', category: '文件', shortcut: 'Ctrl+O',
      execute: () => ctx.openFile() },
    { id: 'file:save', label: '保存', category: '文件', shortcut: 'Ctrl+S',
      execute: () => ctx.saveFile() },
    { id: 'file:save-as', label: '另存为', category: '文件', shortcut: 'Ctrl+Shift+S',
      execute: () => ctx.saveAs() },
    { id: 'edit:find', label: '查找替换', category: '编辑', shortcut: 'Ctrl+F',
      execute: () => ctx.findInDocument() },
    { id: 'view:sidebar', label: '切换侧边栏', category: '视图', shortcut: 'Ctrl+\\',
      execute: () => ctx.toggleSidebar() },
    { id: 'view:toggle-mode', label: '切换编辑模式', category: '视图', shortcut: 'Ctrl+Shift+P',
      execute: () => ctx.toggleMode() },
    { id: 'view:preview', label: '切换预览模式', category: '视图', shortcut: 'Ctrl+Shift+O',
      execute: () => ctx.togglePreview() },
    { id: 'view:focus', label: '专注模式', category: '视图', shortcut: 'F11',
      execute: () => ctx.toggleFocus() },
    { id: 'view:typewriter', label: '打字机模式', category: '视图', shortcut: 'F12',
      execute: () => ctx.toggleTypewriter() },
    { id: 'theme:toggle', label: '切换浅色/深色', category: '主题',
      execute: () => ctx.toggleTheme() },
    { id: 'tool:search', label: '全局搜索', category: '工具', shortcut: 'Ctrl+Shift+F',
      execute: () => ctx.search() },
    { id: 'export:html', label: '导出 HTML', category: '导出', shortcut: 'Ctrl+Shift+H',
      execute: () => ctx.exportHtml() },
    { id: 'export:pdf', label: '导出 PDF', category: '导出', shortcut: 'Ctrl+Shift+E',
      execute: () => ctx.exportPdf() },
    { id: 'settings:open', label: '打开设置', category: '设置',
      execute: () => ctx.openSettings() },
    { id: 'settings:plugins', label: '插件管理', category: '设置', shortcut: 'Ctrl+Shift+I',
      execute: () => ctx.openSettings('plugin') },
  ]
}

// ── Fuzzy search (simple, no fuse.js dependency) ──

function score(item: PaletteCommand, query: string): number {
  const q = query.toLowerCase()
  let s = 0
  if (item.label.toLowerCase().startsWith(q)) s += 10
  else if (item.label.toLowerCase().includes(q)) s += 5
  if (item.keywords?.some((k) => k.toLowerCase().includes(q))) s += 3
  if (item.description?.toLowerCase().includes(q)) s += 2
  if (item.category.toLowerCase().includes(q)) s += 1
  return s
}

export function searchCommands(
  all: PaletteCommand[],
  query: string,
): PaletteCommand[] {
  if (!query.trim()) return all
  const trimmed = query.trim()

  if (trimmed.startsWith('@')) {
    const pluginQuery = trimmed.slice(1).trim().toLowerCase()
    return all.filter(
      (c) =>
        (c.id.startsWith('plugin:') || c.id.startsWith('builtin:')) &&
        (c.label.toLowerCase().includes(pluginQuery) ||
          c.id.toLowerCase().includes(pluginQuery)),
    )
  }

  return all
    .map((c) => ({ cmd: c, score: score(c, trimmed) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.cmd)
}

// ── Merger ──

export function mergeAllCommands(
  builtins: PaletteCommand[],
  pluginCmds: CommandDef[],
): PaletteCommand[] {
  const pluginPalette: PaletteCommand[] = pluginCmds.map((c) => ({
    ...c,
    category: c.category || '插件',
    keywords: c.keywords ?? [],
  }))
  const merged = new Map<string, PaletteCommand>()
  for (const c of builtins) merged.set(c.id, c)
  for (const c of pluginPalette) merged.set(c.id, c)
  return Array.from(merged.values())
}
