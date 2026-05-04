import type { HostAPIBridge } from './types/host-api'
import type { Plugin, PluginManifest, PluginContext } from './types/plugin'
import { SandboxFactory } from './SandboxFactory'
import { scanPluginDir, readPluginEntry } from './ScannerIPC'
import { DependencyGraph, CyclicDependencyError } from './DependencyGraph'
import { EventBus } from './EventBus'
import { ConfigDB } from './ConfigDB'

export interface EngineOptions {
  bridge: HostAPIBridge
  builtinDir: string
  userDir?: string
  builtinPlugins?: Record<string, Plugin>
}

export class PluginEngine {
  private bridge: HostAPIBridge
  private sandbox: SandboxFactory
  readonly events: EventBus
  readonly configDB: ConfigDB
  private depGraph: DependencyGraph
  private registry: Map<string, Plugin> = new Map()
  private activeIds: Set<string> = new Set()
  private resourceCleanups: Map<string, (() => void)[]> = new Map()
  private options: EngineOptions

  constructor(options: EngineOptions) {
    this.options = options
    this.bridge = options.bridge
    this.sandbox = new SandboxFactory()
    this.events = new EventBus()
    this.configDB = new ConfigDB()
    this.depGraph = new DependencyGraph()
  }

  async start(): Promise<void> {
    // 注册内置插件
    if (this.options.builtinPlugins) {
      for (const plugin of Object.values(this.options.builtinPlugins)) {
        this.register(plugin)
      }
    }
    // 扫描用户插件目录，只加载上次启用的
    if (this.options.userDir) {
      const userPlugins = await scanPluginDir(this.options.userDir)
      const enabledIds = new Set(this.configDB.getEnabledIds())
      for (const pkg of userPlugins) {
        if (this.registry.has(pkg.id)) continue
        // 记录发现到配置（但按启用状态决定是否激活）
        this.configDB.markInstalled(pkg.id)
        if (enabledIds.has(pkg.id) || !this.configDB.get(pkg.id).installedAt) {
          await this.loadPackage(pkg)
        }
      }
    }
    this.activateAll()
    this.events.emit('app:ready', {})
    console.log(`[引擎] ✅ 启动完成，已激活 ${this.activeIds.size} 个插件`)
  }

  register(plugin: Plugin): boolean {
    const id = plugin.manifest.id
    if (this.registry.has(id)) { console.warn(`[引擎] 插件 ${id} 已注册，跳过`); return false }
    this.registry.set(id, plugin)
    this.depGraph.add(id, plugin.manifest.dependencies || [])
    return true
  }

  activateAll(): void {
    const allIds = Array.from(this.registry.keys())
    const satisfiable = allIds.filter((id) => {
      const missing = this.depGraph.getMissing(id, new Set(this.registry.keys()))
      if (missing.length > 0) {
        console.warn(`[引擎] 插件 ${id} 依赖缺失: ${missing.join(', ')}，跳过`)
        return false
      }
      return true
    })
    try {
      const ordered = this.depGraph.resolveOrder(satisfiable)
      for (const id of ordered) {
        if (this.activate(id)) {
          this.configDB.setEnabled(id, true)
          this.events.emit('plugin:activated', { id })
        }
      }
    } catch (err) {
      if (err instanceof CyclicDependencyError) {
        console.error(`[引擎] 循环依赖: ${err.cyclicIds.join(' → ')}`)
      } else {
        console.error('[引擎] 依赖解析失败:', err)
      }
    }
  }

  activate(id: string): boolean {
    const plugin = this.registry.get(id)
    if (!plugin) { console.warn(`[引擎] 插件 ${id} 未注册`); return false }
    if (this.activeIds.has(id)) return true
    try {
      const ctx = this.createContext(plugin.manifest)
      plugin.onActivate?.call(plugin, ctx)
      this.activeIds.add(id)
      this.configDB.setEnabled(id, true)
      console.log(`[引擎] ✅ 已激活: ${plugin.manifest.name} (${id})`)
      return true
    } catch (err) {
      console.error(`[引擎] ❌ 激活失败 ${id}:`, err)
      return false
    }
  }

  deactivate(id: string): void {
    const plugin = this.registry.get(id)
    if (!plugin || !this.activeIds.has(id)) return
    try { plugin.onDeactivate?.call(plugin) } catch (err) {
      console.error(`[引擎] 卸载 onDeactivate 异常 ${id}:`, err)
    }
    this.cleanupAll(id)
    this.events.removeAllByPlugin(id)
    this.depGraph.remove(id)
    this.activeIds.delete(id)
    this.configDB.setEnabled(id, false)
    this.events.emit('plugin:deactivated', { id })
    console.log(`[引擎] 已卸载: ${plugin.manifest.name} (${id})`)
  }

  getPlugins(): PluginManifest[] {
    return Array.from(this.registry.values()).map((p) => p.manifest)
  }

  isActive(id: string): boolean {
    return this.activeIds.has(id)
  }

  /** 扫描目录，返回尚未加载的可发现插件 */
  async findAvailablePlugins(): Promise<any[]> {
    const dirs: string[] = [this.options.builtinDir]
    if (this.options.userDir) dirs.push(this.options.userDir)
    const results = await Promise.all(dirs.map((d) => scanPluginDir(d).catch(() => [])))
    const flat = results.flat()
    const registeredIds = new Set(this.registry.keys())
    return flat.filter((p) => !registeredIds.has(p.id))
  }

  loadExternalPlugin(code: string, fileName?: string): { ok: boolean; error?: string } {
    try {
      const plugin = this.sandbox.execute(code)
      this.register(plugin)
      if (!this.activate(plugin.manifest.id)) {
        throw new Error('插件激活失败')
      }
      this.configDB.markInstalled(plugin.manifest.id)
      this.configDB.setEnabled(plugin.manifest.id, true)
      console.log(`[引擎] ✅ 外部插件加载成功: ${plugin.manifest.name} (${fileName ?? 'unknown'})`)
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[引擎] ❌ 外部插件加载失败 [${fileName ?? 'unknown'}]:`, msg)
      return { ok: false, error: msg }
    }
  }

  // ── 内部 ──

  private async loadPackage(pkg: import('./ScannerIPC').PluginPackage): Promise<boolean> {
    try {
      const code = await readPluginEntry(pkg.entryPath)
      const plugin = this.sandbox.execute(code)
      this.register(plugin)
      return true
    } catch (err) {
      console.error(`加载插件 ${pkg.id} 失败:`, err)
      return false
    }
  }

  private createContext(manifest: PluginManifest): PluginContext {
    const pluginId = manifest.id
    return {
      getContent: () => this.bridge.getEditorContent(),
      getCursorPosition: () => this.bridge.getCursorPosition(),
      getActiveFilePath: () => this.bridge.getActiveTabFilePath(),
      addStatusBarItem: (item) => {
        const remove = this.bridge.addStatusBarItem(item)
        this.trackResource(pluginId, remove)
        return remove
      },
      addSidebarTab: (tab) => {
        const remove = this.bridge.addSidebarTab(tab)
        this.trackResource(pluginId, remove)
        return remove
      },
      addStyle: (css) => {
        const style = document.createElement('style')
        style.id = `plugin-style-${pluginId}`
        style.textContent = css
        document.head.appendChild(style)
        const remove = () => style.remove()
        this.trackResource(pluginId, remove)
        return remove
      },
      onContentChange: (cb) => {
        const remove = this.bridge.onContentChange(cb)
        this.trackResource(pluginId, remove)
        return remove
      },
      console: {
        log: console.log.bind(console, `[${manifest.id}]`),
        warn: console.warn.bind(console, `[${manifest.id}]`),
        error: console.error.bind(console, `[${manifest.id}]`),
      },
      events: {
        on: (event: any, handler: any) => this.events.on(pluginId, event, handler),
      },
    }
  }

  private trackResource(pluginId: string, disposer: () => void): void {
    if (!this.resourceCleanups.has(pluginId)) {
      this.resourceCleanups.set(pluginId, [])
    }
    this.resourceCleanups.get(pluginId)!.push(disposer)
  }

  private cleanupAll(pluginId: string): void {
    const fns = this.resourceCleanups.get(pluginId)
    if (fns) { fns.forEach((fn) => { try { fn() } catch {} }); this.resourceCleanups.delete(pluginId) }
  }
}
