import { useState, useEffect, useCallback } from 'react'
import * as bridge from '../../services/electron-bridge'

interface Props { onClose: () => void }
type TabType = 'loaded' | 'available' | 'disabled'

function getEngine(): any { return (window as any).__pluginEngine }

function PluginManagerDialog({ onClose }: Props) {
  const engine = getEngine()
  const [activeTab, setActiveTab] = useState<TabType>('loaded')
  const [loadedPlugins, setLoadedPlugins] = useState<any[]>(() => engine?.getPlugins() ?? [])
  const [availablePlugins, setAvailablePlugins] = useState<any[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')

  const showMsg = useCallback((type: 'success' | 'error', text: string) => {
    setMsgType(type); setMsg(text); setTimeout(() => setMsg(''), 3500)
  }, [])

  const refreshLoaded = useCallback(() => {
    const e = getEngine()
    if (e) setLoadedPlugins(e.getPlugins())
  }, [])

  const refreshAvailable = useCallback(async () => {
    const e = getEngine()
    if (e) setAvailablePlugins(await e.findAvailablePlugins())
  }, [])

  useEffect(() => { if (activeTab === 'available') refreshAvailable() }, [activeTab, refreshAvailable])

  const handleLoad = useCallback(async () => {
    const file = await bridge.openPluginDialog()
    if (!file) return
    const fileName = file.filePath.split(/[/\\]/).pop() ?? 'unknown'
    const e = getEngine()
    if (!e) { showMsg('error', '引擎未初始化'); return }
    const result = e.loadExternalPlugin(file.content, fileName)
    if (result.ok) { showMsg('success', `✅ 已加载: ${fileName}`); refreshLoaded(); refreshAvailable() }
    else { showMsg('error', `❌ 加载失败: ${fileName}\n${result.error ?? ''}`) }
  }, [refreshLoaded, refreshAvailable, showMsg])

  const handleLoadAvailable = useCallback(async (pkg: any) => {
    const e = getEngine()
    if (!e) return
    try {
      const { readPluginEntry } = await import('../../engine/ScannerIPC')
      const code = await readPluginEntry(pkg.entryPath)
      const result = e.loadExternalPlugin(code, pkg.id)
      if (result.ok) { showMsg('success', `✅ 已加载: ${pkg.name}`); refreshLoaded(); refreshAvailable() }
      else { showMsg('error', `❌ 加载失败: ${result.error}`) }
    } catch (err) {
      showMsg('error', `❌ 加载失败: ${err}`)
    }
  }, [refreshLoaded, refreshAvailable, showMsg])

  const handleToggle = useCallback((id: string, name: string) => {
    const e = getEngine()
    if (!e) return
    if (e.configDB.isEnabled(id)) {
      e.deactivate(id); showMsg('success', `已禁用: ${name}`)
    } else {
      const all = Array.from(e['registry'].values())
      const plugin = all.find((p: any) => p.manifest.id === id)
      if (plugin) { e.register(plugin); e.activate(id); showMsg('success', `已启用: ${name}`) }
    }
    refreshLoaded()
  }, [refreshLoaded, showMsg])

  const handleUnload = useCallback((id: string, name: string) => {
    const e = getEngine()
    if (e) { e.deactivate(id); showMsg('success', `已卸载: ${name}`); refreshLoaded(); refreshAvailable() }
  }, [refreshLoaded, refreshAvailable, showMsg])

  const handleOpenDir = useCallback(async () => {
    const e = getEngine()
    if (e?.options?.userDir) await bridge.revealInExplorer(e.options.userDir)
  }, [])

  const handleOverlay = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const enabledMap: Record<string, boolean> = {}
  if (engine) for (const p of loadedPlugins) enabledMap[p.id] = engine.configDB.isEnabled(p.id)

  const loaded = loadedPlugins
  const disabled = loadedPlugins.filter((p: any) => !(enabledMap[p.id] ?? true))

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'loaded', label: '已加载', count: loaded.length - disabled.length },
    { key: 'available', label: '可用', count: availablePlugins.length },
    { key: 'disabled', label: '已禁用', count: disabled.length },
  ]

  return (
    <div className="dialog-overlay" onClick={handleOverlay}>
      <div className="dialog-panel plugin-dialog">
        <div className="dialog-header">
          <span className="dialog-title">插件管理</span>
          <button className="dialog-close" onClick={onClose}>✕</button>
        </div>

        {msg && <div className={`plugin-msg ${msgType}`} style={{ whiteSpace: 'pre-wrap' }}>{msg}</div>}

        <div className="plugin-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`plugin-tab${activeTab === t.key ? ' active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <div className="plugin-list">
          {activeTab === 'loaded' && loaded.filter((p: any) => enabledMap[p.id] !== false).length === 0 && (
            <div className="plugin-empty">暂无已加载的插件</div>
          )}
          {activeTab === 'available' && availablePlugins.length === 0 && (
            <div className="plugin-empty">未发现可用插件</div>
          )}
          {activeTab === 'disabled' && disabled.length === 0 && (
            <div className="plugin-empty">没有已禁用的插件</div>
          )}

          {activeTab === 'loaded' && loaded.filter((p: any) => enabledMap[p.id] !== false).map((p: any) => (
            <PluginItem
              key={p.id}
              plugin={p}
              enabled={enabledMap[p.id] !== false}
              expanded={expandedId === p.id}
              onToggle={() => handleToggle(p.id, p.name)}
              onUnload={() => handleUnload(p.id, p.name)}
              onExpand={() => setExpandedId(expandedId === p.id ? null : p.id)}
              showUnload
            />
          ))}

          {activeTab === 'available' && availablePlugins.map((p: any) => (
            <PluginItem
              key={p.id}
              plugin={p}
              enabled={false}
              expanded={expandedId === p.id}
              onToggle={() => handleLoadAvailable(p)}
              onExpand={() => setExpandedId(expandedId === p.id ? null : p.id)}
              showUnload={false}
            />
          ))}

          {activeTab === 'disabled' && disabled.map((p: any) => (
            <PluginItem
              key={p.id}
              plugin={p}
              enabled={false}
              expanded={expandedId === p.id}
              onToggle={() => handleToggle(p.id, p.name)}
              onUnload={() => handleUnload(p.id, p.name)}
              onExpand={() => setExpandedId(expandedId === p.id ? null : p.id)}
              showUnload
            />
          ))}
        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={handleOpenDir}>打开插件目录</button>
          <button className="btn-primary" onClick={handleLoad}>加载插件...</button>
          <button className="btn-secondary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}

/* ─── 插件条目组件 ─── */
function PluginItem({ plugin, enabled, expanded, onToggle, onUnload, onExpand, showUnload }: {
  plugin: any; enabled: boolean; expanded: boolean
  onToggle: () => void; onUnload?: () => void; onExpand: () => void
  showUnload: boolean
}) {
  return (
    <div>
      <div className="plugin-item">
        <div className="plugin-info">
          <span className="plugin-name">{plugin.name}</span>
          <span className="plugin-ver">v{plugin.version}</span>
          {plugin.description && <span className="plugin-desc">{plugin.description}</span>}
          <label className="plugin-toggle-label">
            <input type="checkbox" checked={enabled} onChange={onToggle} />
            <span className="plugin-toggle-text">{enabled ? '已启用' : '已禁用'}</span>
          </label>
        </div>
        <div className="plugin-actions">
          <button className="plugin-detail-btn" onClick={onExpand}>
            {expanded ? '收起' : '详情'}
          </button>
          {showUnload && onUnload && (
            <button className="plugin-unload-btn" onClick={onUnload}>卸载</button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="plugin-detail">
          <div className="detail-row"><span className="detail-label">ID</span><span className="detail-value">{plugin.id}</span></div>
          <div className="detail-row"><span className="detail-label">版本</span><span className="detail-value">v{plugin.version}</span></div>
          <div className="detail-row"><span className="detail-label">API</span><span className="detail-value">{plugin.apiVersion || '任意'}</span></div>
          <div className="detail-row"><span className="detail-label">权限</span><span className="detail-value">{(plugin.permissions || ['无']).join(', ')}</span></div>
          {plugin.entryPath && <div className="detail-row"><span className="detail-label">路径</span><span className="detail-value detail-path">{plugin.entryPath}</span></div>}
          {plugin.dependencies?.length > 0 && (
            <div className="detail-row"><span className="detail-label">依赖</span><span className="detail-value">{plugin.dependencies.join(', ')}</span></div>
          )}
        </div>
      )}
    </div>
  )
}

export default PluginManagerDialog
