import { getActiveView } from '../editor/active-view'
import { useTabStore } from '../stores/tab-store'
import { usePluginStore } from '../stores/plugin-store'
import type { Plugin, PluginContext, PluginManifest } from '../types/plugin'
import type { Extension } from '@codemirror/state'

/** 全局单例 */
class PluginManager {
  private registry: Map<string, Plugin> = new Map()
  private activeIds: Set<string> = new Set()
  private contentListeners: Map<string, Set<(content: string) => void>> = new Map()
  private cmExtensions: Extension[] = []

  /** 注册插件 */
  register(plugin: Plugin): void {
    if (this.registry.has(plugin.manifest.id)) {
      console.warn(`插件 ${plugin.manifest.id} 已注册，跳过`)
      return
    }
    this.registry.set(plugin.manifest.id, plugin)
  }

  /** 注册所有内置插件 */
  registerBuiltins(plugins: Plugin[]): void {
    plugins.forEach((p) => this.register(p))
  }

  /** 激活指定插件 */
  activate(id: string): boolean {
    const plugin = this.registry.get(id)
    if (!plugin) {
      console.warn(`插件 ${id} 未注册`)
      return false
    }
    if (this.activeIds.has(id)) return true

    try {
      const ctx = this.createContext(plugin.manifest)
      plugin.onActivate?.(ctx)
      this.activeIds.add(id)
      console.log(`插件已激活: ${plugin.manifest.name} (${id})`)
      return true
    } catch (err) {
      console.error(`插件 ${id} 激活失败:`, err)
      return false
    }
  }

  /** 激活所有已注册插件 */
  activateAll(): void {
    this.registry.forEach((_, id) => this.activate(id))
  }

  /** 卸载指定插件 */
  deactivate(id: string): void {
    const plugin = this.registry.get(id)
    if (!plugin || !this.activeIds.has(id)) return
    try {
      plugin.onDeactivate?.()
      this.activeIds.delete(id)
      this.contentListeners.delete(id)
      console.log(`插件已卸载: ${plugin.manifest.name} (${id})`)
    } catch (err) {
      console.error(`插件 ${id} 卸载失败:`, err)
    }
  }

  /** 通知内容变化（由 EditorLayout/EditorPane 调用） */
  notifyContentChange(content: string): void {
    this.contentListeners.forEach((cbs) => {
      cbs.forEach((cb) => {
        try { cb(content) } catch { /* 单个监听器异常不影响其他 */ }
      })
    })
  }

  /** 获取已注册的 CM6 扩展列表 */
  getCmExtensions(): Extension[] {
    return [...this.cmExtensions]
  }

  private createContext(manifest: PluginManifest): PluginContext {
    const pluginId = manifest.id
    const store = usePluginStore.getState()

    return {
      get editorView() { return getActiveView() },
      activeTab: () => useTabStore.getState().activeTab(),

      addSidebarTab: (tab) => store.addSidebarTab(tab),

      addStatusBarItem: (item) => store.addStatusBarItem(item),

      registerCommand: (cmd) => store.registerCommand(cmd),

      registerCmExtension: (ext) => {
        this.cmExtensions.push(ext)
      },

      onContentChange: (cb) => {
        if (!this.contentListeners.has(pluginId)) {
          this.contentListeners.set(pluginId, new Set())
        }
        this.contentListeners.get(pluginId)!.add(cb)
        return () => {
          this.contentListeners.get(pluginId)?.delete(cb)
        }
      },
    }
  }
}

export const pluginManager = new PluginManager()
