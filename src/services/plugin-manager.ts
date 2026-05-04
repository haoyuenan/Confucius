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

  register(plugin: Plugin): void {
    if (this.registry.has(plugin.manifest.id)) {
      console.warn(`插件 ${plugin.manifest.id} 已注册，跳过`)
      return
    }
    this.registry.set(plugin.manifest.id, plugin)
  }

  registerBuiltins(plugins: Plugin[]): void {
    plugins.forEach((p) => this.register(p))
  }

  activate(id: string): boolean {
    const plugin = this.registry.get(id)
    if (!plugin) { console.warn(`插件 ${id} 未注册`); return false }
    if (this.activeIds.has(id)) return true
    try {
      const ctx = this.createContext(plugin.manifest)
      plugin.onActivate?.call(plugin, ctx)
      this.activeIds.add(id)
      console.log(`✅ 插件已激活: ${plugin.manifest.name} (${id})`)
      return true
    } catch (err) {
      console.error(`❌ 插件 ${id} 激活失败:`, err)
      return false
    }
  }

  activateAll(): void {
    this.registry.forEach((_, id) => this.activate(id))
  }

  deactivate(id: string): void {
    const plugin = this.registry.get(id)
    if (!plugin || !this.activeIds.has(id)) return
    try {
      plugin.onDeactivate?.call(plugin)
      this.activeIds.delete(id)
      this.contentListeners.delete(id)
      console.log(`插件已卸载: ${plugin.manifest.name} (${id})`)
    } catch (err) {
      console.error(`插件 ${id} 卸载失败:`, err)
    }
  }

  notifyContentChange(content: string): void {
    this.contentListeners.forEach((cbs) => {
      cbs.forEach((cb) => { try { cb(content) } catch { /* ignore */ } })
    })
  }

  getCmExtensions(): Extension[] {
    return [...this.cmExtensions]
  }

  /* ── 外部插件加载 ── */

  /** 加载外部 .js 插件文件（纯 JS 沙箱执行） */
  loadExternalPlugin(code: string, fileName?: string): { ok: boolean; error?: string } {
    try {
      // 插件格式要求：直接通过 module.exports = { manifest, onActivate, onDeactivate } 导出
      const sandbox = { module: { exports: {} as any }, exports: {} as any }
      const fn = new Function('module', 'exports', code)
      fn(sandbox.module, sandbox.exports)
      const plugin: Plugin = sandbox.module.exports?.default || sandbox.module.exports

      if (!plugin) throw new Error('module.exports 未定义')
      if (!plugin?.manifest?.id) throw new Error('插件格式无效：缺少 manifest.id')
      if (!plugin?.onActivate) throw new Error('插件格式无效：缺少 onActivate 方法')

      this.register(plugin)
      if (!this.activate(plugin.manifest.id)) {
        throw new Error('插件激活失败（查看控制台了解详情）')
      }
      console.log(`✅ 外部插件加载成功: ${plugin.manifest.name} (${fileName ?? 'unknown'})`)
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`❌ 外部插件加载失败 [${fileName ?? 'unknown'}]:`, msg)
      return { ok: false, error: msg }
    }
  }

  /** 获取已注册的插件列表 */

  /** 获取已注册的插件列表 */
  getRegisteredPlugins(): PluginManifest[] {
    return Array.from(this.registry.values()).map((p) => p.manifest)
  }

  private createContext(manifest: PluginManifest): PluginContext {
    const pluginId = manifest.id
    const store = usePluginStore.getState()
    let cleanupFns: (() => void)[] = []

    const ctx: PluginContext = {
      get editorView() { return getActiveView() },
      activeTab: () => useTabStore.getState().activeTab(),
      getContent: () => document.querySelector('.cm-content')?.textContent ?? '',

      addStatusBarItem: (item) => {
        const remove = store.addStatusBarItem(item)
        cleanupFns.push(remove)
        return remove
      },

      addSidebarTab: (tab) => {
        const remove = store.addSidebarTab(tab)
        cleanupFns.push(remove)
        return remove
      },

      addStyle: (css) => {
        const style = document.createElement('style')
        style.id = `plugin-style-${pluginId}`
        style.textContent = css
        document.head.appendChild(style)
        const remove = () => style.remove()
        cleanupFns.push(remove)
        return remove
      },

      console: { log: console.log.bind(console), warn: console.warn.bind(console), error: console.error.bind(console) },

      registerCommand: (cmd) => store.registerCommand(cmd),

      registerCmExtension: (ext) => { this.cmExtensions.push(ext) },

      onContentChange: (cb) => {
        if (!this.contentListeners.has(pluginId)) {
          this.contentListeners.set(pluginId, new Set())
        }
        this.contentListeners.get(pluginId)!.add(cb)
        return () => { this.contentListeners.get(pluginId)?.delete(cb) }
      },
    }

    return ctx
  }
}

export const pluginManager = new PluginManager()
