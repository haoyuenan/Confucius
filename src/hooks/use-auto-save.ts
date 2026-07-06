import { useEffect } from 'react'
import { useTabStore } from '../stores/tab-store'
import * as bridge from '../services/bridge'

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
    let timer: ReturnType<typeof setTimeout>

    const tick = () => {
      const tab = useTabStore.getState().activeTab()
      if (tab && tab.filePath && tab.isModified) {
        bridge.writeFile(tab.filePath, tab.content)
          .then(() => {
            const s = useTabStore.getState()
            const t = s.tabs.find(t2 => t2.id === tab.id)
            if (t) s.markTabSaved(tab.id)
          })
          .catch((err) => console.error('自动保存失败:', err))
      }
      // 每轮结束后重新读取间隔，使设置修改即时生效（避免闭包捕获旧值）
      timer = setTimeout(tick, getAutoSaveInterval())
    }

    timer = setTimeout(tick, getAutoSaveInterval())
    return () => clearTimeout(timer)
  }, [])
}
