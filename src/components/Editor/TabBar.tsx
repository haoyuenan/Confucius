import { useTabStore } from '../../stores/tab-store'
import styles from './TabBar.module.css'

function TabBar() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const activateTab = useTabStore((s) => s.activateTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const newUntitledTab = useTabStore((s) => s.newUntitledTab)

  return (
    <div className={styles.tabBar}>
      <div className={styles.tabList}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`${styles.tabItem}${tab.id === activeTabId ? ` ${styles.active}` : ''}`}
            onClick={() => activateTab(tab.id)}
          >
            <span className={styles.tabIcon}>📄</span>
            <span className={styles.tabName}>{tab.fileName}</span>
            {tab.isModified && <span className={styles.tabModified}>●</span>}
            <button
              className={styles.tabClose}
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
            >✕</button>
          </div>
        ))}
      </div>
      <button className={styles.tabNewBtn} onClick={newUntitledTab} title="新建标签">+</button>
    </div>
  )
}

export default TabBar
