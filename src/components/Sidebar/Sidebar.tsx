import { useRef, useEffect } from 'react'
import { useSidebarStore } from '../../stores/sidebar-store'
import { usePluginStore } from '../../stores/plugin-store'
import { useI18nStore } from '../../i18n/i18n-store'
import type { SidebarTabDef } from '../../types/plugin'
import FileTreePanel from './FileTreePanel'
import OutlinePanel from './OutlinePanel'
import SearchPanel from './SearchPanel'
import { BacklinksPanel } from './BacklinksPanel'

/** SVG 图标集 */
function TabIcon({ name, size = 20 }: { name: string; size?: number }) {
  const icons: Record<string, string> = {
    files: 'M3 3h7l2 2h5a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z',
    outline: 'M4 6h16M4 10h10M4 14h13M4 18h8',
    search: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z',
    backlinks: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71',
    tags: 'M7 7h.01M7 3h5a2 2 0 012 2v1l7 7-9 9-7-7V5a2 2 0 012-2z',
    graph: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  }
  const d = icons[name]
  if (!d) {
    // 插件自定义 icon（emoji 或文字）
    return <span className="sidebar-icon-emoji">{name}</span>
  }
  const isStroke = name === 'outline' || name === 'search'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {isStroke
        ? <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        : <path d={d} fill="currentColor" />}
    </svg>
  )
}

/** 将插件 render() 返回的 HTMLElement 挂载到 React 容器 */
function PluginTabPanel({ tab }: { tab: SidebarTabDef }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    if (tab.render) {
      const el = tab.render()
      container.appendChild(el)
      return () => { container.innerHTML = '' }
    }
  }, [tab])

  if (tab.component) {
    return <>{tab.component}</>
  }
  return <div ref={containerRef} className="plugin-tab-panel" />
}

function Sidebar() {
  const activeTab = useSidebarStore((s) => s.activeTab)
  const setActiveTab = useSidebarStore((s) => s.setActiveTab)
  const pluginTabs = usePluginStore((s) => s.sidebarTabs)
  const t = useI18nStore((s) => s.t)

  const builtinTabs: { id: string; label: string; icon: string }[] = [
    { id: 'file-tree', label: t('sidebar.tab.files'), icon: 'files' },
    { id: 'outline', label: t('sidebar.tab.outline'), icon: 'outline' },
    { id: 'search', label: t('sidebar.tab.search'), icon: 'search' },
    { id: 'backlinks', label: '反链', icon: 'backlinks' },
    { id: 'tags', label: '标签', icon: 'tags' },
    { id: 'graph', label: '图谱', icon: 'graph' },
  ]

  const allTabs = [
    ...builtinTabs,
    ...pluginTabs.map((pt) => ({
      id: pt.id,
      label: pt.id === 'doc-templates' ? t('plugin.name.docTemplates')
        : pt.id === 'code-runner' ? t('plugin.name.codeRunner')
        : pt.label,
      icon: pt.icon || '🧩',
    })),
  ]

  const activePluginTab = pluginTabs.find((pt) => pt.id === activeTab)

  return (
    <div className="sidebar-container">
      <div className="sidebar-icon-bar">
        {allTabs.map((tab) => (
          <button
            key={tab.id}
            data-testid={`sidebar-tab-${tab.id}`}
            className={`sidebar-icon-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            <TabIcon name={tab.icon} />
          </button>
        ))}
      </div>

      <div className="sidebar-main">
        <div className="sidebar-panel-header">
          {allTabs.find((t) => t.id === activeTab)?.label ?? ''}
        </div>
        <div className="sidebar-content">
          {activeTab === 'file-tree' && <FileTreePanel />}
          {activeTab === 'outline' && <OutlinePanel />}
          {activeTab === 'search' && <SearchPanel />}
          {activeTab === 'backlinks' && <BacklinksPanel />}
          {activeTab === 'tags' && <span className="sidebar-hint">标签面板即将到来</span>}
          {activeTab === 'graph' && <span className="sidebar-hint">图谱即将到来</span>}
          {activePluginTab && <PluginTabPanel tab={activePluginTab} />}
        </div>
      </div>
    </div>
  )
}

export default Sidebar
