import { useRef, useEffect } from 'react'
import { useSidebarStore } from '../../stores/sidebar-store'
import { usePluginStore } from '../../stores/plugin-store'
import type { SidebarTabDef } from '../../types/plugin'
import FileTreePanel from './FileTreePanel'
import OutlinePanel from './OutlinePanel'
import SearchPanel from './SearchPanel'

/** 内置标签页（icon 使用 SVG path） */
const BUILTIN_TABS: { id: string; label: string; icon: string }[] = [
  { id: 'file-tree', label: '文件', icon: 'files' },
  { id: 'outline', label: '大纲', icon: 'outline' },
  { id: 'search', label: '搜索', icon: 'search' },
]

/** SVG 图标集 */
function TabIcon({ name, size = 20 }: { name: string; size?: number }) {
  const icons: Record<string, string> = {
    files: 'M3 3h7l2 2h5a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z',
    outline: 'M4 6h16M4 10h10M4 14h13M4 18h8',
    search: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z',
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

  const allTabs = [
    ...BUILTIN_TABS,
    ...pluginTabs.map((pt) => ({ id: pt.id, label: pt.label, icon: pt.icon || '🧩' })),
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
          {activePluginTab && <PluginTabPanel tab={activePluginTab} />}
        </div>
      </div>
    </div>
  )
}

export default Sidebar
