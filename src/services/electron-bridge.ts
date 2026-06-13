/**
 * Tauri IPC 调用封装层
 *
 * 所有组件通过此模块访问 Tauri 后端能力。
 * 文件操作走 Rust commands（绕过 Tauri fs scope 限制），
 * 对话框/剪贴板/事件走 @tauri-apps/plugin-*。
 */

import type { FileTreeNode } from '../types/file-tree'
import type { SearchResult } from '../types/search'
import { open, save } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

// ─── 文件操作（通过 Rust commands，无 scope 限制）───

/** 读取文件（UTF-8，如含 BOM 会自动去除） */
export async function readFile(filePath: string): Promise<{ content: string; filePath: string }> {
  const content = await invoke<string>('read_file_utf8', { path: filePath })
  // 去除 BOM
  const cleaned = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content
  return { content: cleaned, filePath }
}

/** 写文件 UTF-8 */
export function writeFile(filePath: string, content: string): Promise<void> {
  return invoke('write_file_utf8', { path: filePath, content })
}

/** 通过文件对话框打开 .md 文件 */
export async function openFileDialog(): Promise<{ content: string; filePath: string } | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  })
  if (!selected) return null
  const filePath = selected as string
  return readFile(filePath)
}

/** 通过保存对话框选择路径 */
export function saveFileDialog(): Promise<string | null> {
  return save({
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  })
}

/** 确认保存对话框 */
export async function confirmSave(): Promise<0 | 1 | 2> {
  const { ask } = await import('@tauri-apps/plugin-dialog')
  const { useI18nStore } = await import('../i18n/i18n-store')
  const t = useI18nStore.getState().t
  const result = await ask(t('dialog.confirmSave.message'), {
    title: t('dialog.confirmSave.title'),
    kind: 'warning',
    okLabel: t('dialog.confirmSave.ok'),
    cancelLabel: t('dialog.confirmSave.cancel'),
  })
  return result ? 0 : 1
}

// ─── 文件树 ───

export function buildFileTree(rootPath: string): Promise<FileTreeNode> {
  return invoke('build_file_tree', { rootPath })
}

// ─── 文件监听 ───

export function startFileWatcher(rootPath: string): Promise<void> {
  return invoke('start_file_watcher', { rootPath })
}

export function stopFileWatcher(): Promise<void> {
  return invoke('stop_file_watcher')
}

export function onFileTreeChanged(callback: () => void): () => void {
  const unlistenPromise = listen('file-tree-changed', () => {
    callback()
  })
  return () => {
    unlistenPromise.then((fn) => fn())
  }
}

// ─── 侧边栏 ───

/** 打开文件夹对话框 */
export async function openFolderDialog(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: true,
  })
  return (selected as string) ?? null
}

/** 侧边栏右键菜单（Tauri 无原生菜单 → dispatch DOM 事件让前端处理） */
export async function showSidebarContextMenu(nodePath: string, nodeType: string): Promise<void> {
  window.dispatchEvent(new CustomEvent('sidebar-context-menu', { detail: { nodePath, nodeType } }))
}

export function onSidebarAction(callback: (data: { action: string; path: string }) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail) callback(detail)
  }
  window.addEventListener('sidebar-action', handler)
  return () => window.removeEventListener('sidebar-action', handler)
}

export function createFile(parentPath: string, fileName = '未命名.md'): Promise<boolean> {
  return invoke('create_file', { parentPath, fileName }).then(() => true).catch(() => false)
}

export function createDir(parentPath: string, dirName = '新建文件夹'): Promise<boolean> {
  return invoke('create_dir', { parentPath, dirName }).then(() => true).catch(() => false)
}

export function renameItem(oldPath: string, newName: string): Promise<void> {
  return invoke('rename_item', { oldPath, newName })
}

export function deleteItem(targetPath: string): Promise<void> {
  return invoke('delete_item', { targetPath })
}

export function revealInExplorer(_targetPath: string): Promise<void> {
  // Tauri 上暂不支持 showItemInFolder 等价物，后续可加 shell command
  return Promise.resolve()
}

// ─── 搜索 ───

export function searchQuery(params: {
  rootPath: string
  query: string
  caseSensitive?: boolean
  regex?: boolean
  maxResults?: number
}): Promise<SearchResult[]> {
  return invoke('search_text', {
    rootPath: params.rootPath,
    query: params.query,
    caseSensitive: params.caseSensitive ?? false,
    useRegex: params.regex ?? false,
    maxResults: params.maxResults ?? 500,
  })
}

// ─── 导出 ───

/** 导出 HTML：生成 HTML 字符串后写入文件 */
export async function exportHtml(): Promise<void> {
  const rawHtml = (window as any).__exportPreviewHTML__?.() || ''
  if (typeof rawHtml !== 'string') return

  const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Confucius 导出文档</title>
<style>
.markdown-body{--bgColor-default:#fff;--bgColor-muted:#f6f8fa;--fgColor-default:#1f2328;--fgColor-muted:#656d76;--fgColor-accent:#0969da;--borderColor-default:#d0d7de;color-scheme:light;box-sizing:border-box;min-width:200px;max-width:980px;margin:0 auto;padding:32px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7}
.markdown-body h1{font-size:2em;border-bottom:1px solid var(--borderColor-default);padding-bottom:.3em}
.markdown-body h2{font-size:1.5em;border-bottom:1px solid var(--borderColor-default);padding-bottom:.3em}
.markdown-body code{padding:.2em .4em;font-size:85%;background:var(--bgColor-muted);border-radius:4px}
.markdown-body pre{padding:16px;overflow:auto;font-size:85%;background:var(--bgColor-muted);border-radius:6px}
.markdown-body img{max-width:100%}
</style></head>
<body class="markdown-body">${rawHtml}</body></html>`

  const filePath = await save({
    filters: [{ name: 'HTML', extensions: ['html'] }],
    defaultPath: 'document.html',
  })
  if (!filePath) return
  await writeFile(filePath, fullHtml)
  window.dispatchEvent(new CustomEvent('export-done', { detail: { format: 'HTML', path: filePath } }))
}

/** 导出 PDF：使用系统打印对话框 */
export async function exportPdf(): Promise<void> {
  window.print()
}

export async function printPreview(): Promise<void> {
  window.print()
}

export function onExportDone(callback: (info: { format: string; path: string }) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail) callback(detail)
  }
  window.addEventListener('export-done', handler)
  return () => window.removeEventListener('export-done', handler)
}

/** 监听外部文件打开 */
export function onFileOpen(callback: (data: { filePath: string; content: string }) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail) callback(detail)
  }
  window.addEventListener('file-open', handler)
  return () => window.removeEventListener('file-open', handler)
}

// ─── 菜单与事件 ───

export function onMenuAction(callback: (action: string) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail?.action) callback(detail.action)
  }
  window.addEventListener('menu-action', handler)
  return () => window.removeEventListener('menu-action', handler)
}

// ─── 应用 ───

export async function getVersion(): Promise<string> {
  return invoke('get_app_version')
}

export async function getEnv(): Promise<{ electron: string; chrome: string; node: string; platform: string; arch: string }> {
  return {
    electron: '-', // 已迁移至 Tauri
    chrome: navigator.userAgent.match(/Chrome\/(\S+)/)?.[1] || '',
    node: '',
    platform: navigator.platform,
    arch: navigator.platform.includes('64') ? 'x64' : 'x86',
  }
}

export function setMenuVisible(_visible: boolean): Promise<void> {
  return Promise.resolve()
}

export function translateMenu(_labels: Record<string, string>): Promise<void> {
  return Promise.resolve()
}

// ─── 知识库 ───

import { KnowledgeService } from './knowledge-service'

const _knowledgeService = new KnowledgeService()

export function knowledgeInitialize(workspacePath: string): Promise<boolean> {
  return _knowledgeService.initialize(workspacePath)
}

export function knowledgeGetBacklinks(filePath: string) {
  return _knowledgeService.getBacklinks(filePath)
}

export function knowledgeGetGraph(filePath?: string) {
  return _knowledgeService.getGraphData(filePath)
}

export function knowledgeGetTags() {
  return _knowledgeService.getTags()
}

export function knowledgeSearchFiles(query: string) {
  return _knowledgeService.searchFiles(query)
}

export function knowledgeCreateDailyNote(): Promise<string> {
  return _knowledgeService.createDailyNote()
}

export function knowledgeResolveLink(linkTitle: string) {
  return Promise.resolve(_knowledgeService.resolveLink(linkTitle))
}

export function knowledgeReindex(filePath: string): Promise<boolean> {
  return _knowledgeService.reindex(filePath)
}
