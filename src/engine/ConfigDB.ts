/**
 * ConfigDB — 插件配置持久化存储
 *
 * 使用 localStorage 存储，支持启用/关闭、自定义设置。
 * 所有方法同步执行，不涉及异步操作。
 */

const STORAGE_KEY = 'confucius:plugin-config'

export interface PluginConfigEntry {
  enabled: boolean
  settings: Record<string, unknown>
  installedAt?: number
}

interface StorageData {
  version: number
  plugins: Record<string, PluginConfigEntry>
}

export class ConfigDB {
  /** 读取单个插件配置 */
  get(pluginId: string): PluginConfigEntry {
    const all = this.load()
    return all[pluginId] || { enabled: true, settings: {} }
  }

  /** 更新插件配置 */
  set(pluginId: string, entry: Partial<PluginConfigEntry>): void {
    const all = this.load()
    all[pluginId] = { ...this.get(pluginId), ...entry }
    this.save(all)
  }

  /** 检测插件是否启用 */
  isEnabled(pluginId: string): boolean {
    return this.get(pluginId).enabled
  }

  /** 设置启用/禁用 */
  setEnabled(pluginId: string, enabled: boolean): void {
    this.set(pluginId, { enabled })
  }

  /** 获取所有已启用插件的 ID 列表 */
  getEnabledIds(): string[] {
    const all = this.load()
    return Object.entries(all)
      .filter(([, cfg]) => cfg.enabled !== false)
      .map(([id]) => id)
  }

  /** 删除插件配置 */
  remove(pluginId: string): void {
    const all = this.load()
    delete all[pluginId]
    this.save(all)
  }

  /** 记录插件安装时间 */
  markInstalled(pluginId: string): void {
    if (!this.load()[pluginId]) {
      this.set(pluginId, { enabled: true, settings: {}, installedAt: Date.now() })
    }
  }

  /** 导出全部配置 */
  exportAll(): Record<string, PluginConfigEntry> {
    return this.load()
  }

  private load(): Record<string, PluginConfigEntry> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return {}
      const data: StorageData = JSON.parse(raw)
      return data.plugins || {}
    } catch {
      return {}
    }
  }

  private save(plugins: Record<string, PluginConfigEntry>): void {
    const data: StorageData = { version: 1, plugins }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }
}
