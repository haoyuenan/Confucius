/**
 * ScannerIPC — 渲染进程侧的插件扫描器
 *
 * 通过 IPC 调用主进程的 ScannerService
 */

export interface PluginPackage {
  id: string
  name: string
  version: string
  apiVersion?: string
  entryPath: string
  manifestPath: string
  description?: string
  source: 'builtin' | 'user'
}

export async function scanPluginDir(dirPath: string): Promise<PluginPackage[]> {
  const raw = await window.electronAPI.scannerScan(dirPath)
  return raw.map((p: any) => ({ ...p, source: dirPath.includes('builtins') ? 'builtin' : 'user' as const }))
}

export async function readPluginEntry(entryPath: string): Promise<string> {
  const result = await window.electronAPI.scannerReadEntry(entryPath)
  return result.code
}
