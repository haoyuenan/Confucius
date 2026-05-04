import fs from 'fs/promises'
import path from 'path'

export interface PluginPackage {
  id: string
  name: string
  version: string
  apiVersion?: string
  entryPath: string
  manifestPath: string
  description?: string
  permissions?: string[]
}

/**
 * ScannerService — 在 Electron 主进程中扫描插件目录
 *
 * 通过 IPC 暴露给渲染进程使用。
 * 避免渲染进程直接访问文件系统。
 */
export class ScannerService {
  /** 扫描插件目录，返回所有合法插件包 */
  async scanDirectory(dirPath: string): Promise<PluginPackage[]> {
    const result: PluginPackage[] = []

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (entry.name.startsWith('.')) continue
        if (entry.name === 'disabled') continue

        const pkg = await this.loadManifest(path.join(dirPath, entry.name))
        if (pkg) result.push(pkg)
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.warn(`扫描插件目录失败 ${dirPath}:`, err)
      }
    }

    return result
  }

  /** 读取插件入口文件 */
  async readEntry(entryPath: string): Promise<{ code: string }> {
    const code = await fs.readFile(entryPath, 'utf-8')
    return { code }
  }

  /** 读取并验证单个插件目录的 manifest.json */
  private async loadManifest(pluginDir: string): Promise<PluginPackage | null> {
    const manifestPath = path.join(pluginDir, 'manifest.json')
    const entryPath = path.join(pluginDir, 'index.js')

    try {
      const raw = await fs.readFile(manifestPath, 'utf-8')
      const json = JSON.parse(raw)

      if (!json.id || !json.name || !json.version) {
        console.warn(`manifest.json 缺少必填字段: ${manifestPath}`)
        return null
      }

      try {
        await fs.stat(entryPath)
      } catch {
        console.warn(`插件 ${json.id} 缺少入口文件: ${entryPath}`)
        return null
      }

      return {
        id: json.id,
        name: json.name,
        version: json.version,
        apiVersion: json.apiVersion || '^1.0.0',
        entryPath,
        manifestPath,
        description: json.description,
        permissions: json.permissions || [],
      }
    } catch (err) {
      console.warn(`读取插件清单失败 ${pluginDir}:`, err)
      return null
    }
  }
}
