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
  // Tauri 上暂不支持 showItemInFolder 等价物
  return Promise.resolve()
}

/** 读取文件原始内容（UTF-8，供知识库内部使用） */
export const readFileRaw: (path: string) => Promise<string> = (path) =>
  invoke('read_file_utf8', { path })

/** 检查文件是否存在（供知识库内部使用） */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await invoke('stat_file', { path })
    return true
  } catch { return false }
}

/** 读取目录条目（供知识库内部使用） */
export const readDir: (path: string) => Promise<{ name: string; is_directory: boolean }[]> = (path) =>
  invoke('read_dir_entries', { path })

/** 获取文件状态（供知识库内部使用） */
export const statFile: (path: string) => Promise<{ size: number; modified: string; is_dir: boolean }> = (path) =>
  invoke('stat_file', { path })

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

/** 导出 PDF：同打印预览，只输出预览内容 */
export async function exportPdf(): Promise<void> {
  return printPreview()
}

/** 获取预览 HTML 源码（优先从 DOM，fallback 到即时渲染） */
function getPreviewHTML(): string | null {
  // 优先取已渲染的预览 DOM（split / preview 模式下有 PreviewPane 实例）
  if (typeof (window as any).__exportPreviewHTML__ === 'function') {
    const html = (window as any).__exportPreviewHTML__()
    if (html) return html
  }
  return null
}

/** 构建打印用的独立 HTML 文档 */
function buildPrintDocument(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Confucius 打印预览</title>
<style>
  body {
    padding: 32px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
    font-size: 16px;
    line-height: 1.7;
    color: #1f2328;
    max-width: 980px;
    margin: 0 auto;
  }
  h1, h2 { border-bottom: 1px solid #d0d7de; padding-bottom: .3em; }
  h1 { font-size: 2em; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1em; }
  code { padding: .2em .4em; font-size: 85%; background: #f6f8fa; border-radius: 4px; font-family: "SF Mono","Fira Code","Consolas",monospace; }
  pre { padding: 16px; overflow-x: auto; font-size: 85%; background: #f6f8fa; border-radius: 6px; line-height: 1.45; }
  pre code { padding: 0; background: transparent; }
  img { max-width: 100%; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #d0d7de; padding: 8px 12px; text-align: left; }
  th { background: #f6f8fa; font-weight: 600; }
  blockquote { padding: 0 1em; color: #656d76; border-left: .25em solid #d0d7de; margin: 0; }
  p { margin: .5em 0; }
  ul, ol { margin: .5em 0; padding-left: 2em; }
  hr { border: none; border-top: 1px solid #d0d7de; margin: 24px 0; }
  .mermaid-rendered svg { max-width: 100%; height: auto; }
  .katex { font-size: 1.1em; }
  @media print { body { padding: 0; } }
</style></head>
<body>${bodyHtml}</body></html>`
}

/** 打印预览内容：用隐藏 iframe 加载独立 HTML 文档，绕过主窗口的 overflow 限制 */
export async function printPreview(): Promise<void> {
  const bodyHtml = getPreviewHTML()
  if (!bodyHtml) {
    console.warn('[print] 没有可打印的预览内容')
    return
  }

  const printDoc = buildPrintDocument(bodyHtml)

  // 创建隐藏 iframe（拥有独立的 document 上下文，打印引擎会正确分页）
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none'
  document.body.appendChild(iframe)

  const iframeWin = iframe.contentWindow
  if (!iframeWin) {
    document.body.removeChild(iframe)
    console.warn('[print] 无法获取 iframe contentWindow')
    return
  }

  // 写入文档（同步写入，内容立即可用）
  iframeWin.document.open()
  iframeWin.document.write(printDoc)
  iframeWin.document.close()

  // 清理函数
  const cleanup = () => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe)
    }
  }

  // 打印完成后自动清理
  iframeWin.onafterprint = cleanup

  // 兜底清理（30 秒后）
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe)
    }
  }, 30_000)

  // 触发打印
  iframeWin.focus()
  iframeWin.print()
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

export async function getEnv(): Promise<{ tauri: string; platform: string; arch: string }> {
  const ver = await invoke<string>('get_app_version')
  return {
    tauri: ver,
    platform: navigator.platform,
    arch: navigator.platform.includes('64') ? 'x64' : 'x86',
  }
}

export function setMenuVisible(_visible: boolean): Promise<void> {
  // 在 Tauri 中菜单由配置文件管理，此接口保留为空操作
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
