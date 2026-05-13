import { useTabStore } from '../../stores/tab-store'
import { useAppStore } from '../../stores/app-store'
import styles from './TabBar.module.css'

function TabBar() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const activateTab = useTabStore((s) => s.activateTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const newUntitledTab = useTabStore((s) => s.newUntitledTab)
  const sidebarVisible = useAppStore((s) => s.sidebarVisible)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)

  return (
    <div className={styles.tabBar}>
      <button
        className={`${styles.sidebarToggle}${!sidebarVisible ? ` ${styles.collapsed}` : ''}`}
        onClick={toggleSidebar}
        title={sidebarVisible ? '隐藏侧边栏' : '显示侧边栏'}
      >
        <svg className={styles.sidebarIcon} viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
          <line x1="6" y1="1.5" x2="6" y2="14.5" />
          <rect className={styles.leftFill} x="2.5" y="2.5" width="2.5" height="11" rx="0.8" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <div className={styles.tabList}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            data-testid="tab-item"
            className={`${styles.tabItem}${tab.id === activeTabId ? ` ${styles.active}` : ''}`}
            onClick={() => activateTab(tab.id)}
          >
            <span className={styles.tabIcon}>📄</span>
            <span data-testid="tab-name" className={styles.tabName}>{tab.fileName}</span>
            {tab.isModified && <span className={styles.tabModified}>●</span>}
            <button
              data-testid="tab-close"
              className={styles.tabClose}
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
            >✕</button>
          </div>
        ))}
      </div>
      <button data-testid="tab-new" className={styles.tabNewBtn} onClick={newUntitledTab} title="新建标签">+</button>
    </div>
  )
}

export default TabBar
