import { useTabStore } from '../../stores/tab-store'

function TabBar() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const activateTab = useTabStore((s) => s.activateTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const newUntitledTab = useTabStore((s) => s.newUntitledTab)

  return (
    <div className="tab-bar">
      <div className="tab-list">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-item${tab.id === activeTabId ? ' active' : ''}`}
            onClick={() => activateTab(tab.id)}
          >
            <span className="tab-icon">📄</span>
            <span className="tab-name">{tab.fileName}</span>
            {tab.isModified && <span className="tab-modified">●</span>}
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.id)
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button className="tab-new-btn" onClick={newUntitledTab} title="新建标签">
        +
      </button>
    </div>
  )
}

export default TabBar
