import { useCallback, useEffect } from 'react'
import PluginPanel from './PluginPanel'

interface Props { onClose: () => void }

function PluginManagerDialog({ onClose }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const handleOverlay = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  return (
    <div className="dialog-overlay" onClick={handleOverlay}>
      <div className="dialog-panel plugin-dialog">
        <div className="dialog-header">
          <span className="dialog-title">插件管理</span>
          <button className="dialog-close" onClick={onClose}>✕</button>
        </div>
        <PluginPanel />
      </div>
    </div>
  )
}

export default PluginManagerDialog
