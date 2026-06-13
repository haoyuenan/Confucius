import { useSidebarStore } from '../../stores/sidebar-store'
import { useI18nStore } from '../../i18n/i18n-store'
import FileTreePanel from './FileTreePanel'
import OutlinePanel from './OutlinePanel'
import SearchPanel from './SearchPanel'
import { BacklinksPanel } from './BacklinksPanel'
import { TagPanel } from './TagPanel'
import { GraphView } from './GraphView'

/** SVG 图标集 */
function TabIcon({ name, size = 20 }: { name: string; size?: number }) {
  const icons: Record<string, string> = {
    files: 'M3 3h7l2 2h5a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z',
    outline: 'M4 6h16M4 10h10M4 14h13M4 18h8',
    search: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z',
    backlinks: 'M19 12H5m7-7l-7 7 7 7',
    tags: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01',
    graph: 'M12 2l9 5v10l-9 5-9-5V7l9-5z',
  }
  const d = icons[name]
  if (!d) return null
  const isStroke = name === 'outline' || name === 'search' || name === 'backlinks' || name === 'tags' || name === 'graph'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {isStroke
        ? <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        : <path d={d} fill="currentColor" />}
    </svg>
  )
}

function Sidebar() {
  const activeTab = useSidebarStore((s) => s.activeTab)
  const setActiveTab = useSidebarStore((s) => s.setActiveTab)
  const t = useI18nStore((s) => s.t)

  const allTabs = [
    { id: 'file-tree', label: t('sidebar.tab.files'), icon: 'files' },
    { id: 'outline', label: t('sidebar.tab.outline'), icon: 'outline' },
    { id: 'search', label: t('sidebar.tab.search'), icon: 'search' },
    { id: 'backlinks', label: t('sidebar.tab.backlinks'), icon: 'backlinks' },
    { id: 'tags', label: t('sidebar.tab.tags'), icon: 'tags' },
    { id: 'graph', label: t('sidebar.tab.graph'), icon: 'graph' },
  ]

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
          {activeTab === 'tags' && <TagPanel />}
          {activeTab === 'graph' && <GraphView />}
        </div>
      </div>
    </div>
  )
}

export default Sidebar
