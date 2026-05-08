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
  /** 记录已扫描的合法插件目录 */
  private knownPluginDirs: Set<string> = new Set()

  /** 扫描插件目录，返回所有合法插件包 */
  async scanDirectory(dirPath: string): Promise<PluginPackage[]> {
    const result: PluginPackage[] = []
    // 记录此目录为合法插件根
    this.knownPluginDirs.add(path.resolve(dirPath))

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (entry.name.startsWith('.')) continue
        if (entry.name === 'disabled') continue

        const pkg = await this.loadManifest(path.join(dirPath, entry.name))
        if (pkg) result.push(pkg)
      }
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code
      if (code !== 'ENOENT') {
        console.warn(`scan plugin dir failed ${dirPath}:`, err)
      }
    }

    return result
  }

  /** 读取插件入口文件（限制只能读取已扫描插件目录下的文件） */
  async readEntry(entryPath: string): Promise<{ code: string }> {
    const resolved = path.resolve(entryPath)
    // 安全校验：文件路径必须位于已知的插件目录之下
    let allowed = false
    for (const dir of this.knownPluginDirs) {
      if (resolved.startsWith(dir + path.sep) || resolved.startsWith(dir + '/')) {
        allowed = true
        break
      }
    }
    if (!allowed) {
      throw new Error(`拒绝：entryPath 不在合法插件目录内: ${entryPath}`)
    }
    const code = await fs.readFile(resolved, 'utf-8')
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
        console.warn(`manifest.json missing required fields: ${manifestPath}`)
        return null
      }

      try {
        await fs.stat(entryPath)
      } catch {
        console.warn(`plugin ${json.id} missing entry file: ${entryPath}`)
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
      console.warn(`read plugin manifest failed ${pluginDir}:`, err)
      return null
    }
  }
}
