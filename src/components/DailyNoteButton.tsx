import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TemplatePicker } from './TemplatePicker'

export function DailyNoteButton() {
  const { t } = useTranslation()
  const [showPicker, setShowPicker] = useState(false)

  const handleClick = useCallback(() => {
    setShowPicker(true)
  }, [])

  const handleClose = useCallback(() => {
    setShowPicker(false)
  }, [])

  return (
    <>
      <button className="toolbar-btn" onClick={handleClick} title={t('app.toolbar.newNoteTitle')}>
        {t('app.toolbar.newNote')}
      </button>
      {showPicker && <TemplatePicker onClose={handleClose} />}
    </>
  )
}
