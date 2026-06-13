/**
 * Tauri IPC 调用封装层
 *
 * 所有组件通过此模块访问 Tauri 后端能力。
 * 统一 API 签名与原来的 electron-bridge.ts 保持一致。
 */

import type { FileTreeNode } from '../types/file-tree'
import type { SearchResult } from '../types/search'
import {
  readFile as tauriReadFile,
  writeFile as tauriWriteFile,
  remove as tauriRemove,
  rename as tauriRename,
} from '@tauri-apps/plugin-fs'
import { open, save, ask } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

// ─── 文件操作 ───

/** 读取文件（支持编码检测，返回 UTF-8 字符串） */
export async function readFile(filePath: string): Promise<{ content: string; filePath: string }> {
  // 读为二进制 bytes，交给编码检测模块
  const bytes = await tauriReadFile(filePath)
  const content = await decodeBuffer(bytes)
  return { content, filePath }
}

/** 写文件 UTF-8 */
export function writeFile(filePath: string, content: string): Promise<void> {
  return tauriWriteFile(filePath, new TextEncoder().encode(content))
}

/** 通过文件对话框打开 .md 文件 */
export async function openFileDialog(): Promise<{ content: string; filePath: string } | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  })
  if (!selected) return null
  const filePath = selected as string
  const content = await decodeBuffer(await tauriReadFile(filePath))
  return { content, filePath }
}

/** 通过保存对话框选择路径 */
export function saveFileDialog(): Promise<string | null> {
  return save({
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  })
}

/** 确认保存对话框 */
export async function confirmSave(): Promise<0 | 1 | 2> {
  const result = await ask('当前文件尚未保存，是否保存？', {
    title: '确认保存',
    kind: 'warning',
    okLabel: '保存',
    cancelLabel: '不保存',
  })
  // 0 = save, 1 = don't save, 2 = cancel (ask has no cancel, so map accordingly)
  // Actually ask returns boolean. We'll map to 0/1 and assume no cancel from this simple dialog
  return result ? 0 : 1
}

// ─── 编码检测（内部使用 jschardet + TextDecoder）───

let _jschardet: any = null
async function getJschardet(): Promise<any> {
  if (!_jschardet) {
    _jschardet = await import('jschardet')
  }
  return _jschardet
}

async function decodeBuffer(buffer: Uint8Array): Promise<string> {
  // Check BOM
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(buffer.slice(3))
  }
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(buffer.slice(2))
  }
  if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(buffer.slice(2))
  }

  // Detect encoding
  const jschardet = await getJschardet()
  const detected = jschardet.detect(buffer)
  const encoding = detected?.encoding || 'utf-8'
  const normalized = normalizeEncoding(encoding)

  try {
    if (normalized === 'utf-8') {
      return new TextDecoder('utf-8').decode(buffer)
    }
    return new TextDecoder(normalized).decode(buffer)
  } catch {
    // Fallback to UTF-8
    return new TextDecoder('utf-8').decode(buffer)
  }
}

const ENC_MAP: Record<string, string> = {
  utf8: 'utf-8',
  utf_8: 'utf-8',
  ascii: 'utf-8',
  gb2312: 'gbk',
  gbk: 'gbk',
  gb18030: 'gbk',
  big5: 'big5',
  'big-5': 'big5',
  shiftjis: 'shift-jis',
  shift_jis: 'shift-jis',
  sjis: 'shift-jis',
  euckr: 'euc-kr',
  euc_kr: 'euc-kr',
  eucjp: 'euc-jp',
  euc_jp: 'euc-jp',
  iso2022jp: 'iso-2022-jp',
  iso_2022_jp: 'iso-2022-jp',
  'iso-8859-1': 'iso-8859-1',
  latin1: 'iso-8859-1',
  windows1252: 'windows-1252',
}

function normalizeEncoding(enc: string): string {
  const lower = enc.toLowerCase().replace(/[^a-z0-9]/g, '')
  return ENC_MAP[lower] || enc
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

/** 侧边栏右键菜单（Tauri 无原生菜单，改为 emit 事件让 UI 显示自定义菜单） */
export async function showSidebarContextMenu(nodePath: string, nodeType: string): Promise<void> {
  // 在 Tauri 中，右键菜单由前端组件处理（CustomContextMenu）
  // emit 事件让 App.tsx 或 Sidebar 组件处理
  await invoke('sidebar_context_menu', { nodePath, nodeType }).catch(() => {})
  // Fallback: dispatch a custom DOM event for the frontend to handle
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

export function createFile(parentPath: string): Promise<boolean> {
  return invoke('create_file', { parentPath }).then(() => true).catch(() => false)
}

export function createDir(parentPath: string): Promise<boolean> {
  return invoke('create_dir', { parentPath }).then(() => true).catch(() => false)
}

export function renameItem(oldPath: string, newName: string): Promise<void> {
  const dir = oldPath.substring(0, oldPath.lastIndexOf('\\'))
  const newPath = dir + '\\' + newName
  return tauriRename(oldPath, newPath)
}

export function deleteItem(targetPath: string): Promise<void> {
  return tauriRemove(targetPath, { recursive: true })
}

export function revealInExplorer(targetPath: string): Promise<void> {
  return invoke('reveal_in_explorer', { targetPath })
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

/** 导出 HTML：直接生成完整 HTML 字符串，调用保存对话框 */
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
    electron: '0', // Tauri 无 Electron
    chrome: navigator.userAgent.match(/Chrome\/(\S+)/)?.[1] || '',
    node: '',
    platform: navigator.platform,
    arch: navigator.platform.includes('64') ? 'x64' : 'x86',
  }
}

export function setMenuVisible(_visible: boolean): Promise<void> {
  // Tauri 无原生菜单，忽略
  return Promise.resolve()
}

// ─── 国际化 ───

export function translateMenu(_labels: Record<string, string>): Promise<void> {
  // Tauri 无原生菜单，忽略
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
