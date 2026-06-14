import { useEffect } from 'react'
import { useTabStore } from '../stores/tab-store'
import * as bridge from '../services/electron-bridge'

const AUTOSAVE_KEY = 'confucius-autosave-interval'

function getAutoSaveInterval(): number {
  try {
    const val = parseInt(localStorage.getItem(AUTOSAVE_KEY) || '', 10)
    if (val >= 1000 && val <= 30000) return val
  } catch { /* noop */ }
  return 5000
}

export function useAutoSave() {
  useEffect(() => {
    const id = setInterval(() => {
      const tab = useTabStore.getState().activeTab()
      if (!tab || !tab.filePath || !tab.isModified) return
      bridge.writeFile(tab.filePath, tab.content)
        .then(() => {
          const s = useTabStore.getState()
          const t = s.tabs.find(t2 => t2.id === tab.id)
          if (t) s.markTabSaved(tab.id)
        })
        .catch((err) => console.error('自动保存失败:', err))
    }, getAutoSaveInterval())
    return () => clearInterval(id)
  }, [])
}
