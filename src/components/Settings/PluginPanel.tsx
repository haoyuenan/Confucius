import { useState, useEffect, useCallback } from 'react'
import * as bridge from '../../services/electron-bridge'
import type { PluginManifest } from '../../engine/types/plugin'
import type { PluginPackage } from '../../engine/ScannerIPC'
import type { PluginEngine } from '../../engine/PluginEngine'

type TabType = 'loaded' | 'available' | 'disabled'

function getEngine(): PluginEngine | undefined {
  return (window as { __pluginEngine?: PluginEngine }).__pluginEngine
}

interface PluginDetailInfo {
  id: string
  name: string
  version: string
  apiVersion?: string
  description?: string
  permissions?: string[]
  entryPath?: string
  dependencies?: string[]
}

function getDetailInfo(plugin: PluginManifest | PluginPackage): PluginDetailInfo {
  const manifest = plugin as PluginManifest
  const pkg = plugin as PluginPackage
  return {
    id: plugin.id,
    name: plugin.name,
    version: plugin.version,
    apiVersion: plugin.apiVersion,
    description: plugin.description,
    permissions: manifest.permissions,
    entryPath: pkg.entryPath,
    dependencies: manifest.dependencies,
  }
}

export default function PluginPanel() {
  const engine = getEngine()
  const [activeTab, setActiveTab] = useState<TabType>('loaded')
  const [loadedPlugins, setLoadedPlugins] = useState<PluginManifest[]>(() => engine?.getPlugins() ?? [])
  const [availablePlugins, setAvailablePlugins] = useState<PluginPackage[]>([])
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

  const handleLoadAvailable = useCallback(async (pkg: PluginPackage) => {
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
      const all = Array.from(e.registry.values())
      const plugin = all.find((p) => p.manifest.id === id)
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

  const enabledMap: Record<string, boolean> = {}
  if (engine) for (const p of loadedPlugins) enabledMap[p.id] = engine.configDB.isEnabled(p.id)

  const loaded = loadedPlugins
  const disabled = loadedPlugins.filter((p) => !(enabledMap[p.id] ?? true))

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'loaded', label: '已加载', count: loaded.length - disabled.length },
    { key: 'available', label: '可用', count: availablePlugins.length },
    { key: 'disabled', label: '已禁用', count: disabled.length },
  ]

  const enabledPlugins = loaded.filter((p) => enabledMap[p.id] !== false)

  return (
    <div className="plugin-panel">
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
        {activeTab === 'loaded' && enabledPlugins.length === 0 && (
          <div className="plugin-empty">暂无已加载的插件</div>
        )}
        {activeTab === 'available' && availablePlugins.length === 0 && (
          <div className="plugin-empty">未发现可用插件</div>
        )}
        {activeTab === 'disabled' && disabled.length === 0 && (
          <div className="plugin-empty">没有已禁用的插件</div>
        )}

        {activeTab === 'loaded' && enabledPlugins.map((p) => (
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

        {activeTab === 'available' && availablePlugins.map((p) => (
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

        {activeTab === 'disabled' && disabled.map((p) => (
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
      </div>
    </div>
  )
}

/* ─── 插件条目组件 ─── */
interface PluginItemProps {
  plugin: PluginManifest | PluginPackage
  enabled: boolean
  expanded: boolean
  onToggle: () => void
  onUnload?: () => void
  onExpand: () => void
  showUnload: boolean
}

function PluginItem({ plugin, enabled, expanded, onToggle, onUnload, onExpand, showUnload }: PluginItemProps) {
  const info = getDetailInfo(plugin)
  return (
    <div>
      <div className="plugin-item">
        <div className="plugin-info">
          <span className="plugin-name">{info.name}</span>
          <span className="plugin-ver">v{info.version}</span>
          {info.description && <span className="plugin-desc">{info.description}</span>}
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
          <div className="detail-row"><span className="detail-label">ID</span><span className="detail-value">{info.id}</span></div>
          <div className="detail-row"><span className="detail-label">版本</span><span className="detail-value">v{info.version}</span></div>
          <div className="detail-row"><span className="detail-label">API</span><span className="detail-value">{info.apiVersion || '任意'}</span></div>
          <div className="detail-row"><span className="detail-label">权限</span><span className="detail-value">{(info.permissions || ['无']).join(', ')}</span></div>
          {info.entryPath && <div className="detail-row"><span className="detail-label">路径</span><span className="detail-value detail-path">{info.entryPath}</span></div>}
          {info.dependencies && info.dependencies.length > 0 && (
            <div className="detail-row"><span className="detail-label">依赖</span><span className="detail-value">{info.dependencies.join(', ')}</span></div>
          )}
        </div>
      )}
    </div>
  )
}
