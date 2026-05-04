import { useEffect, useCallback } from 'react'
import { useSidebarStore } from '../../stores/sidebar-store'
import { useTabStore } from '../../stores/tab-store'
import { flattenTree, type FileTreeNode } from '../../types/file-tree'
import { fileNameFromPath } from '../../utils/path'
import * as bridge from '../../services/electron-bridge'

function FileTreePanel() {
  const rootPath = useSidebarStore((s) => s.rootPath)
  const fileTree = useSidebarStore((s) => s.fileTree)
  const expandedPaths = useSidebarStore((s) => s.expandedPaths)
  const selectedPath = useSidebarStore((s) => s.selectedPath)
  const setRootPath = useSidebarStore((s) => s.setRootPath)
  const setFileTree = useSidebarStore((s) => s.setFileTree)
  const toggleExpand = useSidebarStore((s) => s.toggleExpand)
  const selectFile = useSidebarStore((s) => s.selectFile)

  const openFile = useTabStore((s) => s.openFile)

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
    const tree = await bridge.buildFileTree(folderPath)
    setFileTree(tree)
    await bridge.startFileWatcher(folderPath)
  }, [setRootPath, setFileTree])

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

  return (
    <div className="file-tree-panel">
      <div className="file-tree-toolbar">
        {rootPath ? (
          <>
            <span className="folder-path" title={rootPath}>
              {fileNameFromPath(rootPath)}
            </span>
            <button className="toolbar-btn" onClick={handleCloseFolder} title="关闭文件夹">✕</button>
          </>
        ) : (
          <button className="open-folder-btn" onClick={handleOpenFolder}>打开文件夹</button>
        )}
      </div>

      <div className="file-tree-list">
        {!rootPath ? (
          <div className="sidebar-empty">打开文件夹以浏览文件</div>
        ) : flatItems.length === 0 ? (
          <div className="sidebar-empty">文件夹为空</div>
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
