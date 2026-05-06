import { contextBridge, ipcRenderer } from 'electron'
import type { FileTreeNode } from './services/file-service'
import type { PluginPackage } from './services/scanner-service'

interface SearchResult {
  filePath: string
  fileName: string
  lineNumber: number
  lineContent: string
  matchStart: number
  matchEnd: number
}

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),

  getEnv: (): Promise<{ electron: string; chrome: string; node: string; platform: string; arch: string }> =>
    ipcRenderer.invoke('app:get-env'),

  openFileDialog: (): Promise<{ content: string; filePath: string } | null> =>
    ipcRenderer.invoke('dialog:open-file'),

  saveFileDialog: (): Promise<string | null> => ipcRenderer.invoke('dialog:save-file'),

  readFile: (filePath: string): Promise<{ content: string; filePath: string }> =>
    ipcRenderer.invoke('file:read', filePath),

  writeFile: (filePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke('file:write', { filePath, content }),

  confirmSave: (): Promise<0 | 1 | 2> => ipcRenderer.invoke('file:confirm-save'),

  onMenuAction: (callback: (action: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) => callback(action)
    ipcRenderer.on('menu:action', handler)
    return () => ipcRenderer.removeListener('menu:action', handler)
  },

  openFolderDialog: (): Promise<string | null> => ipcRenderer.invoke('dialog:open-folder'),

  openPluginDialog: (): Promise<{ content: string; filePath: string } | null> =>
    ipcRenderer.invoke('dialog:open-plugin'),

  buildFileTree: (rootPath: string): Promise<FileTreeNode> =>
    ipcRenderer.invoke('file-tree:build', rootPath),

  startFileWatcher: (rootPath: string): Promise<void> =>
    ipcRenderer.invoke('file-watcher:start', rootPath),

  stopFileWatcher: (): Promise<void> => ipcRenderer.invoke('file-watcher:stop'),

  onFileTreeChanged: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('file-tree:changed', handler)
    return () => ipcRenderer.removeListener('file-tree:changed', handler)
  },

  showSidebarContextMenu: (params: { nodePath: string; nodeType: string }): Promise<void> =>
    ipcRenderer.invoke('sidebar:context-menu', params),

  onSidebarAction: (callback: (action: { action: string; path: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { action: string; path: string }) =>
      callback(data)
    ipcRenderer.on('sidebar:action', handler)
    return () => ipcRenderer.removeListener('sidebar:action', handler)
  },

  createFile: (parentPath: string): Promise<boolean> =>
    ipcRenderer.invoke('sidebar:create-file', parentPath),

  createDir: (parentPath: string): Promise<boolean> =>
    ipcRenderer.invoke('sidebar:create-dir', parentPath),

  renameItem: (oldPath: string, newName: string): Promise<void> =>
    ipcRenderer.invoke('sidebar:rename', { oldPath, newName }),

  deleteItem: (targetPath: string): Promise<void> =>
    ipcRenderer.invoke('sidebar:delete', targetPath),

  revealInExplorer: (targetPath: string): Promise<void> =>
    ipcRenderer.invoke('sidebar:reveal', targetPath),

  searchQuery: (params: {
    rootPath: string
    query: string
    caseSensitive?: boolean
    regex?: boolean
    maxResults?: number
  }): Promise<SearchResult[]> => ipcRenderer.invoke('search:query', params),

  // ---- Phase 4：导出 ----
  exportHtml: (): Promise<void> => ipcRenderer.invoke('export:html'),
  exportPdf: (): Promise<void> => ipcRenderer.invoke('export:pdf'),

  /** 监听导出完成通知 */
  onExportDone: (callback: (info: { format: string; path: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: { format: string; path: string }) =>
      callback(info)
    ipcRenderer.on('export:done', handler)
    return () => ipcRenderer.removeListener('export:done', handler)
  },

  // 外部链接
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open-external', url),

  // Phase 2: 插件系统
  scannerScan: (dirPath: string): Promise<PluginPackage[]> => ipcRenderer.invoke('scanner:scan', dirPath),
  scannerReadEntry: (entryPath: string): Promise<{ code: string }> =>
    ipcRenderer.invoke('scanner:read-entry', entryPath),
})
