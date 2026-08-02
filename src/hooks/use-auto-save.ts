import { useEffect } from 'react'
import { useTabStore } from '../stores/tab-store'

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
    // 串行化写入链：同一时刻只有一个写盘在途，
    // 避免慢写入期间旧快照覆盖新内容（乱序写入）
    let chain: Promise<unknown> = Promise.resolve()

    const tick = () => {
      const tab = useTabStore.getState().activeTab()
      if (tab && tab.filePath && tab.isModified) {
        const tabId = tab.id
        chain = chain
          .then(() => useTabStore.getState().saveTabToDisk(tabId))
          .catch((err) => console.error('自动保存失败:', err))
      }
      // 每轮结束后重新读取间隔，使设置修改即时生效（避免闭包捕获旧值）
      timer = setTimeout(tick, getAutoSaveInterval())
    }

    timer = setTimeout(tick, getAutoSaveInterval())
    return () => clearTimeout(timer)
  }, [])
}
