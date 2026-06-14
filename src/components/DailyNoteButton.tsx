import { useCallback } from 'react'
import { knowledgeCreateDailyNote, readFile } from '../services/bridge'
import { useTabStore } from '../stores/tab-store'
import { useTranslation } from 'react-i18next'

export function DailyNoteButton() {
  const { t } = useTranslation()
  const openFile = useTabStore(s => s.openFile)

  const handleClick = useCallback(async () => {
    const filePath = await knowledgeCreateDailyNote()
    const file = await readFile(filePath)
    openFile(file.filePath, file.content)
  }, [openFile])

  return (
    <button className="toolbar-btn" onClick={handleClick} title={t('app.toolbar.dailyNoteTitle')}>
      {t('app.toolbar.dailyNote')}
    </button>
  )
}
