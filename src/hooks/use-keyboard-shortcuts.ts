import { useEffect } from 'react'

interface KeyboardShortcutOptions {
  onToggleCommandPalette: () => void
  onQuickOpen: () => void
  onDailyNote: () => void
  onSave: () => void
}

export function useKeyboardShortcuts({
  onToggleCommandPalette,
  onQuickOpen,
  onDailyNote,
  onSave,
}: KeyboardShortcutOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key === 'e') {
        e.preventDefault()
        onToggleCommandPalette()
      } else if (ctrl && e.key === 'o') {
        e.preventDefault()
        onQuickOpen()
      } else if (ctrl && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        onDailyNote()
      } else if (ctrl && e.key === 's') {
        e.preventDefault()
        onSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onToggleCommandPalette, onQuickOpen, onDailyNote, onSave])
}
