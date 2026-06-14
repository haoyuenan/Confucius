import { useEffect, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSidebarStore } from '../../stores/sidebar-store'
import { useTabStore } from '../../stores/tab-store'
import { useKnowledgeStore } from '../../stores/knowledge-store'
import { flattenTree, type FileTreeNode } from '../../types/file-tree'
import { fileNameFromPath } from '../../utils/path'
import * as bridge from '../../services/bridge'
import { addRecentFile, getRecentFiles, type RecentFile } from '../../services/recent-files'

/* ─── 欢迎屏（零状态） ─── */
function WelcomePanel({
  onOpenFolder,
  onNewFile,
}: {
  onOpenFolder: () => void
  onNewFile: () => void
}) {
  const { t } = useTranslation()
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(() => getRecentFiles())
  const openFile = useTabStore((s) => s.openFile)

  const handleOpenRecent = useCallback(
    async (filePath: string) => {
      try {
        const result = await bridge.readFile(filePath)
        openFile(result.filePath, result.content)
        addRecentFile(filePath)
        setRecentFiles(getRecentFiles())
      } catch {
        // 文件不存在时刷新列表
        setRecentFiles(getRecentFiles())
      }
    },
    [openFile],
  )

  return (
    <div className="welcome-panel">
      {/* 装饰区 */}
      <div className="welcome-deco" aria-hidden="true">
        <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="welcome-deco-svg">
          {/* 毛笔笔触 */}
          <path d="M20 60 Q30 20 50 15 Q60 12 62 20 Q64 30 50 40 Q38 50 30 65 Q26 72 20 60Z"
            fill="currentColor" opacity="0.12"/>
          {/* 笔尖 */}
          <path d="M60 14 Q65 10 68 12 Q66 16 62 20Z" fill="currentColor" opacity="0.2"/>
          {/* 书卷线条 */}
          <line x1="10" y1="72" x2="70" y2="72" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15"/>
          <line x1="16" y1="76" x2="64" y2="76" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.1"/>
        </svg>
      </div>

      <div className="welcome-text">
        <h2 className="welcome-title">{t('sidebar.welcome.title')}</h2>
        <p className="welcome-subtitle">{t('sidebar.welcome.subtitle')}</p>
      </div>

      <div className="welcome-actions">
        <button className="welcome-btn welcome-btn-primary" onClick={onOpenFolder}>
          <span className="welcome-btn-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                fill="currentColor" opacity="0.9"/>
            </svg>
          </span>
          {t('sidebar.welcome.openFolder')}
        </button>
        <button className="welcome-btn welcome-btn-secondary" onClick={onNewFile}>
          <span className="welcome-btn-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M14 2v6h6M12 12v6M9 15h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </span>
          {t('sidebar.welcome.newNote')}
        </button>
      </div>

      {recentFiles.length > 0 && (
        <div className="welcome-recent">
          <div className="welcome-recent-title">{t('sidebar.welcome.recent')}</div>
          <ul className="welcome-recent-list">
            {recentFiles.slice(0, 5).map((f) => (
              <li key={f.filePath}>
                <button
                  className="welcome-recent-item"
                  onClick={() => handleOpenRecent(f.filePath)}
                  title={f.filePath}
                >
                  <span className="welcome-recent-icon">📄</span>
                  <span className="welcome-recent-name">{f.fileName}</span>
                  <span className="welcome-recent-path">{f.filePath.split(/[\\/]/).slice(-3, -1).join('/')}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ─── 文件树主面板 ─── */
function FileTreePanel() {
  const { t } = useTranslation()
  const rootPath = useSidebarStore((s) => s.rootPath)
  const fileTree = useSidebarStore((s) => s.fileTree)
  const expandedPaths = useSidebarStore((s) => s.expandedPaths)
  const selectedPath = useSidebarStore((s) => s.selectedPath)
  const setRootPath = useSidebarStore((s) => s.setRootPath)
  const setFileTree = useSidebarStore((s) => s.setFileTree)
  const setFileTreeLoading = useSidebarStore((s) => s.setFileTreeLoading)
  const isFileTreeLoading = useSidebarStore((s) => s.isFileTreeLoading)
  const toggleExpand = useSidebarStore((s) => s.toggleExpand)
  const selectFile = useSidebarStore((s) => s.selectFile)

  const openFile = useTabStore((s) => s.openFile)
  const newUntitledTab = useTabStore((s) => s.newUntitledTab)

  // 监听文件变更
  useEffect(() => {
    const cleanup = bridge.onFileTreeChanged(() => {
      const currentRoot = useSidebarStore.getState().rootPath
      if (currentRoot) {
        bridge.buildFileTree(currentRoot).then((tree) => {
          useSidebarStore.getState().refreshFileTree(tree)
        })
      }
    })
    return () => cleanup?.()
  }, [])

  /** 打开文件夹 */
  const handleOpenFolder = useCallback(async () => {
    const folderPath = await bridge.openFolderDialog()
    if (!folderPath) return
    setRootPath(folderPath)
    setFileTreeLoading(true)
    const tree = await bridge.buildFileTree(folderPath)
    setFileTree(tree)
    setFileTreeLoading(false)
    await bridge.startFileWatcher(folderPath)
    // 初始化知识库索引
    useKnowledgeStore.getState().initialize(folderPath)
  }, [setRootPath, setFileTree, setFileTreeLoading])

  /** 关闭文件夹 */
  const handleCloseFolder = useCallback(async () => {
    await bridge.stopFileWatcher()
    setRootPath(null)
    setFileTree(null)
  }, [setRootPath, setFileTree])

  /** 点击文件节点 */
  const handleFileClick = useCallback(
    async (node: FileTreeNode) => {
      if (node.type === 'directory') {
        toggleExpand(node.path)
        return
      }
      if (node.type !== 'file') return
      selectFile(node.path)
      try {
        const result = await bridge.readFile(node.path)
        openFile(result.filePath, result.content)
        addRecentFile(node.path)
      } catch (err) {
        console.error('打开文件失败:', err)
      }
    },
    [toggleExpand, selectFile, openFile],
  )

  /** 右键菜单 */
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, node: FileTreeNode) => {
      e.preventDefault()
      bridge.showSidebarContextMenu(node.path, node.type)
    },
    [],
  )

  const flatItems = fileTree ? flattenTree(fileTree, expandedPaths, 0) : []

  // 未打开文件夹时显示欢迎屏
  if (!rootPath) {
    return <WelcomePanel onOpenFolder={handleOpenFolder} onNewFile={newUntitledTab} />
  }

  return (
    <div className="file-tree-panel">
      <div className="file-tree-toolbar">
        <span className="folder-path" title={rootPath}>
          {fileNameFromPath(rootPath)}
        </span>
        <button className="toolbar-btn" onClick={handleCloseFolder} title={t('sidebar.fileTree.closeFolder')}>✕</button>
      </div>

      <div className="file-tree-list">
        {flatItems.length === 0 && !isFileTreeLoading ? (
          <div className="sidebar-empty">{t('sidebar.fileTree.empty')}</div>
        ) : flatItems.length === 0 && isFileTreeLoading ? (
          <div className="sidebar-empty sidebar-scanning">{t('sidebar.fileTree.scanning')}</div>
        ) : (
          flatItems.map(({ depth, node }) => (
            <div
              key={node.path}
              className={`file-tree-item ${selectedPath === node.path ? 'selected' : ''}`}
              style={{ paddingLeft: 12 + depth * 16 }}
              onClick={() => handleFileClick(node)}
              onContextMenu={(e) => handleContextMenu(e, node)}
            >
              <span className="file-icon">
                {node.type === 'directory'
                  ? expandedPaths.has(node.path) ? '▼' : '▶'
                  : '📄'}
              </span>
              <span className="file-name">{node.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default FileTreePanel
