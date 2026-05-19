import { useState, useEffect, useRef, useCallback } from 'react'
import type { PaletteCommand } from '../../services/command-registry'
import {
  getBuiltinCommands, getRecentCommands, searchCommands,
  mergeAllCommands, saveRecent,
} from '../../services/command-registry'
import { usePluginStore } from '../../stores/plugin-store'
import { useTranslation } from '../../i18n/i18n-store'
import styles from './CommandPalette.module.css'

export interface CommandPaletteContext {
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

interface Props {
  context: CommandPaletteContext
  onClose: () => void
}

export default function CommandPalette({ context, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  const pluginCommands = usePluginStore((s) => s.commands)

  useEffect(() => { inputRef.current?.focus() }, [])

  const all = mergeAllCommands(getBuiltinCommands(context), pluginCommands)
  const recent = getRecentCommands(all)
  const recentIds = new Set(recent.map((c) => c.id))
  const filtered = searchCommands(all, query)

  const recentInResults = recent.filter((r) =>
    query.trim() === '' || filtered.some((f) => f.id === r.id),
  )
  const otherResults = query.trim()
    ? filtered.filter((f) => !recentIds.has(f.id))
    : filtered.filter((f) => !recentIds.has(f.id))

  // Build grouped list
  const grouped: { category: string; commands: PaletteCommand[] }[] = []
  if (recentInResults.length > 0) {
    grouped.push({ category: t('commandPalette.recent'), commands: recentInResults })
  }
  const byCat = new Map<string, PaletteCommand[]>()
  for (const cmd of otherResults) {
    const cat = cmd.category || t('commandPalette.other')
    if (!byCat.has(cat)) byCat.set(cat, [])
    byCat.get(cat)!.push(cmd)
  }
  for (const [cat, cmds] of [...byCat.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    grouped.push({ category: cat, commands: cmds })
  }

  const flatItems = grouped.flatMap((g) => g.commands)

  // Reset selection when results change
  useEffect(() => { setSelectedIndex(0) }, [query])

  // Scroll selected into view
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (flatItems[selectedIndex]) {
          saveRecent(flatItems[selectedIndex].id)
          flatItems[selectedIndex].execute()
          onClose()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [flatItems, selectedIndex, onClose])

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.panel} onKeyDown={handleKeyDown}>
        <div className={styles.searchBox}>
          <span className={styles.searchPrefix}>&gt;</span>
          <input
            ref={inputRef}
            className={styles.searchInput}
            type="text"
            placeholder={t('commandPalette.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className={styles.shortcutHint}>Ctrl+E</span>
        </div>
        <div className={styles.results} ref={listRef}>
          {grouped.length === 0 ? (
            <div className={styles.emptyState}>
              {query.trim() ? t('commandPalette.noMatch', { query }) : t('commandPalette.empty')}
            </div>
          ) : (
            grouped.map((g) => (
              <div key={g.category}>
                <div className={styles.categoryHeader}>{g.category}</div>
                {g.commands.map((cmd) => {
                  const idx = flatItems.indexOf(cmd)
                  return (
                    <div
                      key={cmd.id}
                      data-index={idx}
                      className={`${styles.commandItem}${idx === selectedIndex ? ` ${styles.selected}` : ''}`}
                      onClick={() => {
                        saveRecent(cmd.id); cmd.execute(); onClose()
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <span className={styles.commandLabel}>{cmd.label}</span>
                      {recentIds.has(cmd.id) && (
                        <span className={styles.recentBadge}>{t('commandPalette.recentBadge')}</span>
                      )}
                      {cmd.shortcut && (
                        <span className={styles.commandShortcut}>{cmd.shortcut}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
        <div className={styles.footer}>
          <span><kbd>↑↓</kbd> {t('commandPalette.footer.nav')}</span>
          <span><kbd>Enter</kbd> {t('commandPalette.footer.exec')}</span>
          <span><kbd>Esc</kbd> {t('commandPalette.footer.close')}</span>
          <span style={{ marginLeft: 'auto' }}><kbd>@</kbd> {t('commandPalette.footer.filter')}</span>
        </div>
      </div>
    </div>
  )
}
