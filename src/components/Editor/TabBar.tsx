import { useCallback } from 'react'
import { useTabStore } from '../../stores/tab-store'
import { useAppStore } from '../../stores/app-store'
import { useTranslation } from 'react-i18next'
import styles from './TabBar.module.css'

function TabBar() {
  const { t } = useTranslation()
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const activateTab = useTabStore((s) => s.activateTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const newUntitledTab = useTabStore((s) => s.newUntitledTab)
  const sidebarVisible = useAppStore((s) => s.sidebarVisible)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent, tabId: string) => {
      const idx = tabs.findIndex((t) => t.id === tabId)
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          if (idx > 0) activateTab(tabs[idx - 1].id)
          break
        case 'ArrowRight':
          e.preventDefault()
          if (idx < tabs.length - 1) activateTab(tabs[idx + 1].id)
          break
        case 'Home':
          e.preventDefault()
          if (tabs.length > 0) activateTab(tabs[0].id)
          break
        case 'End':
          e.preventDefault()
          if (tabs.length > 0) activateTab(tabs[tabs.length - 1].id)
          break
        case 'Delete':
          e.preventDefault()
          closeTab(tabId)
          break
      }
    },
    [tabs, activateTab, closeTab],
  )

  return (
    <div className={styles.tabBar}>
      <button
        className={`${styles.sidebarToggle}${!sidebarVisible ? ` ${styles.collapsed}` : ''}`}
        onClick={toggleSidebar}
        title={sidebarVisible ? t('editor.tab.hideSidebar') : t('editor.tab.showSidebar')}
      >
        <svg className={styles.sidebarIcon} viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
          <line x1="6" y1="1.5" x2="6" y2="14.5" />
          <rect className={styles.leftFill} x="2.5" y="2.5" width="2.5" height="11" rx="0.8" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <div className={styles.tabList} role="tablist">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            data-testid="tab-item"
            role="tab"
            aria-selected={tab.id === activeTabId}
            tabIndex={tab.id === activeTabId ? 0 : -1}
            className={`${styles.tabItem}${tab.id === activeTabId ? ` ${styles.active}` : ''}`}
            onClick={() => activateTab(tab.id)}
            onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
          >
            <span className={styles.tabIcon}>📄</span>
            <span data-testid="tab-name" className={styles.tabName}>{tab.fileName}</span>
            {tab.isModified && <span className={styles.tabModified}>●</span>}
            <button
              data-testid="tab-close"
              className={styles.tabClose}
              aria-label={t('editor.tab.closeTab')}
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
            >✕</button>
          </div>
        ))}
      </div>
      <button data-testid="tab-new" className={styles.tabNewBtn} onClick={newUntitledTab} title={t('editor.tab.newTab')}>+</button>
    </div>
  )
}

export default TabBar
