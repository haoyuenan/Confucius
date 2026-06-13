import { useState, useEffect, useRef, useCallback } from 'react'
import type { PaletteCommand } from '../../services/command-registry'
import {
  getBuiltinCommands, getRecentCommands, searchCommands,
  mergeAllCommands, saveRecent,
} from '../../services/command-registry'
import { useKnowledgeStore } from '../../stores/knowledge-store'
import { useTabStore } from '../../stores/tab-store'
import { useTranslation } from '../../i18n/i18n-store'
import * as bridge from '../../services/electron-bridge'
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
  initialMode?: 'command' | 'file'
}

export default function CommandPalette({ context, onClose, initialMode = 'command' }: Props) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mode] = useState<'command' | 'file'>(initialMode)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  const { searchResults, searchFiles } = useKnowledgeStore()
  const openFile = useTabStore((s) => s.openFile)

  useEffect(() => { inputRef.current?.focus() }, [])

  const all = mergeAllCommands(getBuiltinCommands(context))
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

  // Debounced file search
  useEffect(() => {
    if (mode !== 'file') return
    const timer = setTimeout(() => searchFiles(query), 150)
    return () => clearTimeout(timer)
  }, [query, mode, searchFiles])

  // Reset selection when results change
  useEffect(() => { setSelectedIndex(0) }, [query, mode])

  // Scroll selected into view
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleOpenFile = useCallback(async (filePath: string) => {
    try {
      const file = await bridge.readFile(filePath)
      openFile(file.filePath, file.content)
    } catch {
      // file deleted
    }
  }, [openFile])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (mode === 'file') {
          setSelectedIndex((i) => Math.min(i + 1, searchResults.length - 1))
        } else {
          setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1))
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (mode === 'file') {
          const item = searchResults[selectedIndex]
          if (item) {
            handleOpenFile(item.path)
            onClose()
          }
        } else if (flatItems[selectedIndex]) {
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
  }, [mode, flatItems, selectedIndex, onClose, searchResults, handleOpenFile])

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.panel} onKeyDown={handleKeyDown}>
        <div className={styles.searchBox}>
          <span className={styles.searchPrefix}>{mode === 'file' ? '📄' : '>'}</span>
          <input
            ref={inputRef}
            className={styles.searchInput}
            type="text"
            placeholder={mode === 'file' ? '搜索笔记...' : t('commandPalette.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className={styles.shortcutHint}>{mode === 'file' ? 'Ctrl+O' : 'Ctrl+E'}</span>
        </div>
        <div className={styles.results} ref={listRef}>
          {mode === 'file' ? (
            searchResults.length === 0 ? (
              <div className={styles.emptyState}>
                {query.trim() ? `未找到 "${query}"` : '输入文件名搜索'}
              </div>
            ) : (
              <div>
                <div className={styles.categoryHeader}>文件</div>
                {searchResults.map((item, idx) => (
                  <div
                    key={item.path}
                    data-index={idx}
                    className={`${styles.commandItem}${idx === selectedIndex ? ` ${styles.selected}` : ''}`}
                    onClick={() => { handleOpenFile(item.path); onClose() }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className={styles.commandLabel}>{item.title}</span>
                    <span className={styles.commandShortcut}>{item.path}</span>
                  </div>
                ))}
              </div>
            )
          ) : (
            grouped.length === 0 ? (
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
            )
          )}
        </div>
        <div className={styles.footer}>
          <span><kbd>↑↓</kbd> {t('commandPalette.footer.nav')}</span>
          <span><kbd>Enter</kbd> {t('commandPalette.footer.exec')}</span>
          <span><kbd>Esc</kbd> {t('commandPalette.footer.close')}</span>
          <span style={{ marginLeft: 'auto' }}>{mode === 'file' ? '📄 文件模式' : '@ 命令筛选'}</span>
        </div>
      </div>
    </div>
  )
}
