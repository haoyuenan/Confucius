import { useState, useEffect, useCallback } from 'react'
import { pluginManager } from '../../services/plugin-manager'
import * as bridge from '../../services/electron-bridge'

interface Props {
  onClose: () => void
}

function PluginManagerDialog({ onClose }: Props) {
  const [plugins, setPlugins] = useState(() => pluginManager.getRegisteredPlugins())
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')

  const refresh = useCallback(() => {
    setPlugins(pluginManager.getRegisteredPlugins())
  }, [])

  // 加载插件
  const handleLoad = useCallback(async () => {
    const file = await bridge.openPluginDialog()
    if (!file) return

    const fileName = file.filePath.split(/[/\\]/).pop() ?? 'unknown'

    const result = pluginManager.loadExternalPlugin(file.content, fileName)
    if (result.ok) {
      setMsgType('success')
      setMsg(`✅ 已加载: ${fileName}`)
      refresh()
    } else {
      setMsgType('error')
      setMsg(`❌ 加载失败: ${fileName}\n${result.error ?? '未知错误'}`)
    }
    setTimeout(() => setMsg(''), 4000)
  }, [refresh])

  // 卸载插件
  const handleUnload = useCallback((id: string, name: string) => {
    pluginManager.deactivate(id)
    setMsgType('success')
    setMsg(`已卸载: ${name}`)
    refresh()
    setTimeout(() => setMsg(''), 3000)
  }, [refresh])

  // 点击背景关闭
  const handleOverlay = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  // ESC 关闭
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="dialog-overlay" onClick={handleOverlay}>
      <div className="dialog-panel plugin-dialog">
        <div className="dialog-header">
          <span className="dialog-title">插件管理</span>
          <button className="dialog-close" onClick={onClose}>✕</button>
        </div>

        {msg && <div className={`plugin-msg ${msgType}`} style={{ whiteSpace: 'pre-wrap' }}>{msg}</div>}

        <div className="plugin-list">
          {plugins.length === 0 ? (
            <div className="plugin-empty">暂无插件</div>
          ) : (
            plugins.map((p) => (
              <div key={p.id} className="plugin-item">
                <div className="plugin-info">
                  <span className="plugin-name">{p.name}</span>
                  <span className="plugin-ver">v{p.version}</span>
                  {p.description && <span className="plugin-desc">{p.description}</span>}
                  <span className="plugin-id">{p.id}</span>
                </div>
                <button className="plugin-unload-btn" onClick={() => handleUnload(p.id, p.name)}>
                  卸载
                </button>
              </div>
            ))
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn-primary" onClick={handleLoad}>
            加载插件...
          </button>
          <button className="btn-secondary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export default PluginManagerDialog
