import { useSidebarStore, type SidebarTab } from '../../stores/sidebar-store'
import FileTreePanel from './FileTreePanel'
import OutlinePanel from './OutlinePanel'
import SearchPanel from './SearchPanel'

const TABS: { id: SidebarTab; label: string }[] = [
  { id: 'file-tree', label: '文件' },
  { id: 'outline', label: '大纲' },
  { id: 'search', label: '搜索' },
]

function Sidebar() {
  const activeTab = useSidebarStore((s) => s.activeTab)
  const setActiveTab = useSidebarStore((s) => s.setActiveTab)

  return (
    <div className="sidebar-container">
      <div className="sidebar-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="sidebar-content">
        {activeTab === 'file-tree' && <FileTreePanel />}
        {activeTab === 'outline' && <OutlinePanel />}
        {activeTab === 'search' && <SearchPanel />}
      </div>
    </div>
  )
}

export default Sidebar
