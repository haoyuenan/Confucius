import { useEffect } from 'react'

interface KeyboardShortcutOptions {
  onToggleCommandPalette: () => void
  onQuickOpen: () => void
  onDailyNote: () => void
}

export function useKeyboardShortcuts({
  onToggleCommandPalette,
  onQuickOpen,
  onDailyNote,
}: KeyboardShortcutOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault()
        onToggleCommandPalette()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        onQuickOpen()
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        onDailyNote()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onToggleCommandPalette, onQuickOpen, onDailyNote])
}
