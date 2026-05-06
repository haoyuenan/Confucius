/**
 * preload.ts 通过 contextBridge 暴露的 API 类型定义
 */
import type { FileResult } from './file'
import type { SearchResult } from './search'
import type { FileTreeNode } from './file-tree'
import type { PluginPackage } from '../engine/ScannerIPC'

export interface ElectronAPI {
  getVersion: () => Promise<string>
  getEnv: () => Promise<{ electron: string; chrome: string; node: string; platform: string; arch: string }>
  openFileDialog: () => Promise<FileResult | null>
  saveFileDialog: () => Promise<string | null>
  readFile: (filePath: string) => Promise<FileResult>
  writeFile: (filePath: string, content: string) => Promise<void>
  confirmSave: () => Promise<0 | 1 | 2>
  onMenuAction: (callback: (action: string) => void) => () => void

  // Phase 3
  openFolderDialog: () => Promise<string | null>
  openPluginDialog: () => Promise<{ content: string; filePath: string } | null>
  buildFileTree: (rootPath: string) => Promise<FileTreeNode>
  startFileWatcher: (rootPath: string) => Promise<void>
  stopFileWatcher: () => Promise<void>
  onFileTreeChanged: (callback: () => void) => () => void
  showSidebarContextMenu: (params: { nodePath: string; nodeType: string }) => Promise<void>
  onSidebarAction: (callback: (action: { action: string; path: string }) => void) => () => void
  createFile: (parentPath: string) => Promise<boolean>
  createDir: (parentPath: string) => Promise<boolean>
  renameItem: (oldPath: string, newName: string) => Promise<void>
  deleteItem: (targetPath: string) => Promise<void>
  revealInExplorer: (targetPath: string) => Promise<void>
  searchQuery: (params: {
    rootPath: string
    query: string
    caseSensitive?: boolean
    regex?: boolean
    maxResults?: number
  }) => Promise<SearchResult[]>

  // Phase 4
  exportHtml: () => Promise<void>
  exportPdf: () => Promise<void>
  onExportDone: (callback: (info: { format: string; path: string }) => void) => () => void

  // 外部链接
  openExternal: (url: string) => Promise<void>

  // Phase 2: 插件扫描
  scannerScan: (dirPath: string) => Promise<PluginPackage[]>
  scannerReadEntry: (entryPath: string) => Promise<{ code: string }>
}

/** 导出预览 HTML 的函数签名 */
type ExportPreviewHTMLFn = () => string

declare global {
  interface Window {
    electronAPI: ElectronAPI
    /** 供主进程 ExportService 获取渲染后的 HTML 内容 */
    __exportPreviewHTML__?: ExportPreviewHTMLFn
  }
}
