import { useEffect, useCallback } from 'react'
import { useKnowledgeStore } from '../../stores/knowledge-store'
import { useTabStore } from '../../stores/tab-store'
import * as bridge from '../../services/electron-bridge'
import { useTranslation } from '../../i18n/i18n-store'

export function BacklinksPanel() {
  const { t } = useTranslation()
  const activeTab = useTabStore(s => s.activeTab())
  const openFile = useTabStore(s => s.openFile)
  const { backlinks, unlinkedMentions, loadBacklinks } = useKnowledgeStore()

  useEffect(() => {
    if (activeTab?.filePath) {
      loadBacklinks(activeTab.filePath)
    }
  }, [activeTab?.filePath, loadBacklinks])

  const handleOpenFile = useCallback(async (filePath: string) => {
    try {
      const file = await bridge.readFile(filePath)
      openFile(file.filePath, file.content)
    } catch {
      // 文件可能已被删除
    }
  }, [openFile])

  if (!activeTab?.filePath) {
    return <div className="sidebar-panel-empty sidebar-hint">{t('sidebar.backlinks.emptyNoFile')}</div>
  }

  return (
    <div className="sidebar-panel backlinks-panel">
      {backlinks.length === 0 && unlinkedMentions.length === 0 ? (
        <div className="sidebar-hint">{t('sidebar.backlinks.empty')}</div>
      ) : (
        <>
          {backlinks.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">
                {t('sidebar.backlinks.refBy')} <span className="sidebar-count">{backlinks.length}</span>
              </div>
              <ul className="sidebar-file-list">
                {backlinks.map((link, i) => (
                  <li key={i} className="sidebar-file-item" onClick={() => handleOpenFile(link.source)}>
                    <span className="sidebar-file-name">{link.source}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {unlinkedMentions.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">
                {t('sidebar.backlinks.potential')} <span className="sidebar-count">{unlinkedMentions.length}</span>
              </div>
              <ul className="sidebar-file-list">
                {unlinkedMentions.map((mention, i) => (
                  <li key={i} className="sidebar-file-item" onClick={() => handleOpenFile(mention)}>
                    <span className="sidebar-file-name">{mention}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
