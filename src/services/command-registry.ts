import { useI18nStore } from '../i18n/i18n-store'

// ── Types ──

export interface PaletteCommand {
  id: string
  label: string
  category: string
  shortcut?: string
  keywords?: string[]
  description?: string
  execute: () => void
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
  const t = useI18nStore.getState().t
  return [
    { id: 'file:new', label: t('commandPalette.cmd.fileNew'), category: t('commandPalette.cat.file'), shortcut: 'Ctrl+N',
      execute: () => ctx.newUntitledTab() },
    { id: 'file:open', label: t('commandPalette.cmd.fileOpen'), category: t('commandPalette.cat.file'), shortcut: 'Ctrl+O',
      execute: () => ctx.openFile() },
    { id: 'file:save', label: t('commandPalette.cmd.fileSave'), category: t('commandPalette.cat.file'), shortcut: 'Ctrl+S',
      execute: () => ctx.saveFile() },
    { id: 'file:save-as', label: t('commandPalette.cmd.fileSaveAs'), category: t('commandPalette.cat.file'), shortcut: 'Ctrl+Shift+S',
      execute: () => ctx.saveAs() },
    { id: 'edit:find', label: t('commandPalette.cmd.editFind'), category: t('commandPalette.cat.edit'), shortcut: 'Ctrl+F',
      execute: () => ctx.findInDocument() },
    { id: 'view:sidebar', label: t('commandPalette.cmd.viewSidebar'), category: t('commandPalette.cat.view'), shortcut: 'Ctrl+\\',
      execute: () => ctx.toggleSidebar() },
    { id: 'view:toggle-mode', label: t('commandPalette.cmd.viewToggleMode'), category: t('commandPalette.cat.view'), shortcut: 'Ctrl+Shift+P',
      execute: () => ctx.toggleMode() },
    { id: 'view:preview', label: t('commandPalette.cmd.viewPreview'), category: t('commandPalette.cat.view'), shortcut: 'Ctrl+Shift+O',
      execute: () => ctx.togglePreview() },
    { id: 'view:focus', label: t('commandPalette.cmd.viewFocus'), category: t('commandPalette.cat.view'), shortcut: 'F11',
      execute: () => ctx.toggleFocus() },
    { id: 'view:typewriter', label: t('commandPalette.cmd.viewTypewriter'), category: t('commandPalette.cat.view'), shortcut: 'F12',
      execute: () => ctx.toggleTypewriter() },
    { id: 'theme:toggle', label: t('commandPalette.cmd.themeToggle'), category: t('commandPalette.cat.theme'),
      execute: () => ctx.toggleTheme() },
    { id: 'tool:search', label: t('commandPalette.cmd.toolSearch'), category: t('commandPalette.cat.tool'), shortcut: 'Ctrl+Shift+F',
      execute: () => ctx.search() },
    { id: 'export:html', label: t('commandPalette.cmd.exportHtml'), category: t('commandPalette.cat.export'), shortcut: 'Ctrl+Shift+H',
      execute: () => ctx.exportHtml() },
    { id: 'export:pdf', label: t('commandPalette.cmd.exportPdf'), category: t('commandPalette.cat.export'), shortcut: 'Ctrl+Shift+E',
      execute: () => ctx.exportPdf() },
    { id: 'settings:open', label: t('commandPalette.cmd.settingsOpen'), category: t('commandPalette.cat.settings'),
      execute: () => ctx.openSettings() },
    { id: 'settings:plugins', label: t('commandPalette.cmd.settingsPlugins'), category: t('commandPalette.cat.settings'), shortcut: 'Ctrl+Shift+I',
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
    return all.filter(
      (c) =>
        c.id.startsWith('plugin:') || c.id.startsWith('builtin:'),
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
): PaletteCommand[] {
  const merged = new Map<string, PaletteCommand>()
  for (const c of builtins) merged.set(c.id, c)
  return Array.from(merged.values())
}
