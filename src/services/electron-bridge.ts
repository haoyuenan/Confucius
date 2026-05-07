/**
 * Electron IPC 调用封装层
 *
 * 所有组件通过此模块访问 Electron 能力，不直接调用 window.electronAPI。
 * 后续迁移到 Web 版时只需替换此文件。
 */

import type { FileTreeNode } from '../types/file-tree'
import type { SearchResult } from '../types/search'

// ─── 文件操作 ───
export function readFile(filePath: string): Promise<{ content: string; filePath: string }> {
  return window.electronAPI.readFile(filePath)
}
export function writeFile(filePath: string, content: string): Promise<void> {
  return window.electronAPI.writeFile(filePath, content)
}
export function openFileDialog(): Promise<{ content: string; filePath: string } | null> {
  return window.electronAPI.openFileDialog()
}
export function saveFileDialog(): Promise<string | null> {
  return window.electronAPI.saveFileDialog()
}
export function confirmSave(): Promise<0 | 1 | 2> {
  return window.electronAPI.confirmSave()
}

// ─── 文件树 ───
export function buildFileTree(rootPath: string): Promise<FileTreeNode> {
  return window.electronAPI.buildFileTree(rootPath)
}
export function startFileWatcher(rootPath: string): Promise<void> {
  return window.electronAPI.startFileWatcher(rootPath)
}
export function stopFileWatcher(): Promise<void> {
  return window.electronAPI.stopFileWatcher()
}
export function onFileTreeChanged(callback: () => void): () => void {
  return window.electronAPI.onFileTreeChanged(callback)
}

// ─── 侧边栏 ───
export function openFolderDialog(): Promise<string | null> {
  return window.electronAPI.openFolderDialog()
}
export function openPluginDialog(): Promise<{ content: string; filePath: string } | null> {
  return window.electronAPI.openPluginDialog()
}
export function showSidebarContextMenu(nodePath: string, nodeType: string): Promise<void> {
  return window.electronAPI.showSidebarContextMenu({ nodePath, nodeType })
}
export function onSidebarAction(callback: (data: { action: string; path: string }) => void): () => void {
  return window.electronAPI.onSidebarAction(callback)
}
export function createFile(parentPath: string): Promise<boolean> {
  return window.electronAPI.createFile(parentPath)
}
export function createDir(parentPath: string): Promise<boolean> {
  return window.electronAPI.createDir(parentPath)
}
export function renameItem(oldPath: string, newName: string): Promise<void> {
  return window.electronAPI.renameItem(oldPath, newName)
}
export function deleteItem(targetPath: string): Promise<void> {
  return window.electronAPI.deleteItem(targetPath)
}
export function revealInExplorer(targetPath: string): Promise<void> {
  return window.electronAPI.revealInExplorer(targetPath)
}

// ─── 搜索 ───
export function searchQuery(params: {
  rootPath: string
  query: string
  caseSensitive?: boolean
  regex?: boolean
  maxResults?: number
}): Promise<SearchResult[]> {
  return window.electronAPI.searchQuery(params)
}

// ─── 导出 ───
export function exportHtml(): Promise<void> {
  return window.electronAPI.exportHtml()
}
export function exportPdf(): Promise<void> {
  return window.electronAPI.exportPdf()
}
export function onExportDone(callback: (info: { format: string; path: string }) => void): () => void {
  return window.electronAPI.onExportDone(callback)
}

/** 监听外部文件打开（拖拽文件到应用图标） */
export function onFileOpen(callback: (data: { filePath: string; content: string }) => void): () => void {
  return window.electronAPI.onFileOpen(callback)
}

// ─── 菜单与事件 ───
export function onMenuAction(callback: (action: string) => void): () => void {
  return window.electronAPI.onMenuAction(callback)
}

// ─── 应用 ───
export function getVersion(): Promise<string> {
  return window.electronAPI.getVersion()
}
export function getEnv(): Promise<{ electron: string; chrome: string; node: string; platform: string; arch: string }> {
  return window.electronAPI.getEnv()
}
