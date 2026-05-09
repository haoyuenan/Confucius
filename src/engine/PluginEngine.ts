import type { HostAPIBridge } from './types/host-api'
import type { Plugin, PluginManifest, PluginContext } from './types/plugin'
import type { PluginPackage } from './ScannerIPC'
import type { EventName, EventPayload } from './EventBus'
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
  /** 插件注册表 - 对话框需要访问 */
  readonly registry: Map<string, Plugin> = new Map()
  private activeIds: Set<string> = new Set()
  private resourceCleanups: Map<string, (() => void)[]> = new Map()
  /** 引擎配置选项 - 对话框需要访问 userDir */
  readonly options: EngineOptions

  constructor(options: EngineOptions) {
    this.options = options
    this.bridge = options.bridge
    this.sandbox = new SandboxFactory()
    this.events = new EventBus()
    this.configDB = new ConfigDB()
    this.depGraph = new DependencyGraph()
  }

  async start(): Promise<void> {
    console.log('[引擎] 开始启动...')
    // 注册代码级别的内置插件（如 StatusBarPlugin）
    if (this.options.builtinPlugins) {
      console.log(`[引擎] 注册 ${Object.keys(this.options.builtinPlugins).length} 个代码级内置插件`)
      for (const plugin of Object.values(this.options.builtinPlugins)) {
        this.register(plugin)
      }
    }
    // 扫描内置插件目录（打包在安装包中的插件）
    if (this.options.builtinDir) {
      console.log(`[引擎] 扫描内置插件目录: ${this.options.builtinDir}`)
      try {
        const builtinPlugins = await scanPluginDir(this.options.builtinDir)
        console.log(`[引擎] 发现 ${builtinPlugins.length} 个内置插件: ${builtinPlugins.map(p => p.id).join(', ')}`)
        for (const pkg of builtinPlugins) {
          if (this.registry.has(pkg.id)) continue
          this.configDB.markInstalled(pkg.id)
          // 内置插件默认激活
          await this.loadPackage(pkg)
        }
      } catch (err) {
        console.error('[引擎] 扫描内置插件目录失败:', err)
      }
    }
    // 扫描用户插件目录，只加载上次启用的
    if (this.options.userDir) {
      console.log(`[引擎] 扫描用户插件目录: ${this.options.userDir}`)
      try {
        const userPlugins = await scanPluginDir(this.options.userDir)
        console.log(`[引擎] 发现 ${userPlugins.length} 个用户插件`)
        const enabledIds = new Set(this.configDB.getEnabledIds())
        for (const pkg of userPlugins) {
          if (this.registry.has(pkg.id)) continue
          // 记录发现到配置（但按启用状态决定是否激活）
          this.configDB.markInstalled(pkg.id)
          if (enabledIds.has(pkg.id) || !this.configDB.get(pkg.id).installedAt) {
            await this.loadPackage(pkg)
          }
        }
      } catch (err) {
        console.error('[引擎] 扫描用户插件目录失败:', err)
      }
    }
    this.activateAll()
    this.events.emit('app:ready', {})
    console.log(`[引擎] ✅ 启动完成，注册 ${this.registry.size} 个插件，已激活 ${this.activeIds.size} 个`)
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
  async findAvailablePlugins(): Promise<PluginPackage[]> {
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

  private async loadPackage(pkg: PluginPackage): Promise<boolean> {
    try {
      const code = await readPluginEntry(pkg.entryPath)
      const plugin = this.sandbox.execute(code)
      this.register(plugin)
      console.log(`[引擎] ✅ 已加载插件包: ${pkg.name} (${pkg.id})`)
      return true
    } catch (err) {
      console.error(`[引擎] ❌ 加载插件包 ${pkg.id} 失败:`, err)
      return false
    }
  }

  private createContext(manifest: PluginManifest): PluginContext {
    const pluginId = manifest.id
    const perms = new Set(manifest.permissions ?? [])

    function deny(name: string) {
      return () => { throw new Error(`[引擎] 插件 ${manifest.id} 权限不足：${name} 需要声明对应 permission`) }
    }

    function hasPerm(p: string) { return perms.has(p) }

    return {
      getContent: hasPerm('editor') ? () => this.bridge.getEditorContent() : deny('getContent'),
      getCursorPosition: hasPerm('editor') ? () => this.bridge.getCursorPosition() : deny('getCursorPosition'),
      getActiveFilePath: hasPerm('file') ? () => this.bridge.getActiveTabFilePath() : deny('getActiveFilePath'),
      insertText: hasPerm('editor') ? (text: string) => this.bridge.insertText(text) : deny('insertText'),
      addStatusBarItem: hasPerm('ui')
        ? (item) => { const r = this.bridge.addStatusBarItem(item); this.trackResource(pluginId, r); return r }
        : deny('addStatusBarItem'),
      addSidebarTab: hasPerm('ui')
        ? (tab) => { const r = this.bridge.addSidebarTab(tab); this.trackResource(pluginId, r); return r }
        : deny('addSidebarTab'),
      addStyle: hasPerm('ui')
        ? (css) => {
            const style = document.createElement('style')
            style.id = `plugin-style-${pluginId}`
            style.textContent = css
            document.head.appendChild(style)
            const remove = () => style.remove()
            this.trackResource(pluginId, remove)
            return remove
          }
        : deny('addStyle'),
      registerCommand: hasPerm('ui')
        ? (cmd) => { const r = this.bridge.registerCommand(cmd); this.trackResource(pluginId, r); return r }
        : deny('registerCommand'),
      onContentChange: hasPerm('event')
        ? (cb) => { const r = this.bridge.onContentChange(cb); this.trackResource(pluginId, r); return r }
        : deny('onContentChange'),
      console: {
        log: console.log.bind(console, `[${manifest.id}]`),
        warn: console.warn.bind(console, `[${manifest.id}]`),
        error: console.error.bind(console, `[${manifest.id}]`),
      },
      events: {
        on: <N extends EventName>(event: N, handler: (payload: EventPayload<N>) => void) => this.events.on(pluginId, event, handler),
        emit: <N extends EventName>(event: N, payload: EventPayload<N>) => this.events.emit(event, payload),
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
    if (fns) {
      fns.forEach((fn) => {
        try { fn() } catch { /* ignore cleanup errors */ }
      })
      this.resourceCleanups.delete(pluginId)
    }
  }
}
