import { useState, useEffect, useCallback } from 'react'
import * as bridge from '../../services/electron-bridge'
import type { PluginManifest } from '../../engine/types/plugin'
import type { PluginPackage } from '../../engine/ScannerIPC'
import type { PluginEngine } from '../../engine/PluginEngine'
import { useTranslation } from '../../i18n/i18n-store'

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
  const { t } = useTranslation()
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
    if (!e) { showMsg('error', t('plugin.error.engine')); return }
    const result = e.loadExternalPlugin(file.content, fileName)
    if (result.ok) { showMsg('success', t('plugin.success.loaded', { name: fileName })); refreshLoaded(); refreshAvailable() }
    else { showMsg('error', t('plugin.error.load', { name: fileName, error: result.error ?? '' })) }
  }, [refreshLoaded, refreshAvailable, showMsg])

  const handleLoadAvailable = useCallback(async (pkg: PluginPackage) => {
    const e = getEngine()
    if (!e) return
    try {
      const { readPluginEntry } = await import('../../engine/ScannerIPC')
      const code = await readPluginEntry(pkg.entryPath)
      const result = e.loadExternalPlugin(code, pkg.id)
      if (result.ok) { showMsg('success', t('plugin.success.loadPkg', { name: pkg.name })); refreshLoaded(); refreshAvailable() }
      else { showMsg('error', t('plugin.error.loadPkg', { error: result.error ?? '' })) }
    } catch (err) {
      showMsg('error', t('plugin.error.loadPkg', { error: String(err) }))
    }
  }, [refreshLoaded, refreshAvailable, showMsg])

  const handleToggle = useCallback((id: string, name: string) => {
    const e = getEngine()
    if (!e) return
    if (e.configDB.isEnabled(id)) {
      e.deactivate(id); showMsg('success', t('plugin.success.disabled', { name }))
    } else {
      const all = Array.from(e.registry.values())
      const plugin = all.find((p) => p.manifest.id === id)
      if (plugin) { e.register(plugin); e.activate(id); showMsg('success', t('plugin.success.enabled', { name })) }
    }
    refreshLoaded()
  }, [refreshLoaded, showMsg])

  const handleUnload = useCallback((id: string, name: string) => {
    const e = getEngine()
    if (e) { e.deactivate(id); showMsg('success', t('plugin.success.uninstalled', { name })); refreshLoaded(); refreshAvailable() }
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
    { key: 'loaded', label: t('settings.plugin.tab.loaded'), count: loaded.length - disabled.length },
    { key: 'available', label: t('settings.plugin.tab.available'), count: availablePlugins.length },
    { key: 'disabled', label: t('settings.plugin.tab.disabled'), count: disabled.length },
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
          <div className="plugin-empty">{t('settings.plugin.empty.loaded')}</div>
        )}
        {activeTab === 'available' && availablePlugins.length === 0 && (
          <div className="plugin-empty">{t('settings.plugin.empty.available')}</div>
        )}
        {activeTab === 'disabled' && disabled.length === 0 && (
          <div className="plugin-empty">{t('settings.plugin.empty.disabled')}</div>
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
        <button className="btn-secondary" onClick={handleOpenDir}>{t('settings.plugin.openDir')}</button>
        <button className="btn-primary" onClick={handleLoad}>{t('settings.plugin.load')}</button>
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
  const { t } = useTranslation()
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
            <span className="plugin-toggle-text">{enabled ? t('settings.plugin.enabled') : t('settings.plugin.disabled')}</span>
          </label>
        </div>
        <div className="plugin-actions">
          <button className="plugin-detail-btn" onClick={onExpand}>
            {expanded ? t('settings.plugin.detailHide') : t('settings.plugin.detail')}
          </button>
          {showUnload && onUnload && (
            <button className="plugin-unload-btn" onClick={onUnload}>{t('settings.plugin.unload')}</button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="plugin-detail">
          <div className="detail-row"><span className="detail-label">ID</span><span className="detail-value">{info.id}</span></div>
          <div className="detail-row"><span className="detail-label">{t('settings.plugin.version')}</span><span className="detail-value">v{info.version}</span></div>
          <div className="detail-row"><span className="detail-label">{t('settings.plugin.api')}</span><span className="detail-value">{info.apiVersion || t('settings.plugin.any')}</span></div>
          <div className="detail-row"><span className="detail-label">{t('settings.plugin.permissions')}</span><span className="detail-value">{(info.permissions || [t('settings.plugin.none')]).join(', ')}</span></div>
          {info.entryPath && <div className="detail-row"><span className="detail-label">{t('settings.plugin.path')}</span><span className="detail-value detail-path">{info.entryPath}</span></div>}
          {info.dependencies && info.dependencies.length > 0 && (
            <div className="detail-row"><span className="detail-label">{t('settings.plugin.dependencies')}</span><span className="detail-value">{info.dependencies.join(', ')}</span></div>
          )}
        </div>
      )}
    </div>
  )
}
