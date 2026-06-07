import { useCallback } from 'react'
import { knowledgeCreateDailyNote, readFile } from '../services/electron-bridge'
import { useTabStore } from '../stores/tab-store'

export function DailyNoteButton() {
  const openFile = useTabStore(s => s.openFile)

  const handleClick = useCallback(async () => {
    const filePath = await knowledgeCreateDailyNote()
    const file = await readFile(filePath)
    openFile(file.filePath, file.content)
  }, [openFile])

  return (
    <button className="toolbar-btn" onClick={handleClick} title="今日笔记 (Ctrl+Shift+D)">
      📅 今日
    </button>
  )
}
