# Phase 4 详细设计：配置持久化与沙箱增强

**对应**：`docs/plugins/Development-Plan.md` Phase 4
**工时**：3h
**前置**：Phase 3 完成

---

## 1. 设计目标

- `ConfigDB`：插件配置持久化到 `localStorage`，重启恢复
- `SandboxFactory` 增强：Proxy 拦截敏感全局 API
- `PluginEngine.start()` 自动恢复上次启用的插件
- `PluginManagerDialog` 适配：显示配置项、启用/禁用开关

---

## 2. ConfigDB

### 2.1 数据结构

```typescript
// src/engine/ConfigDB.ts

export interface PluginConfigEntry {
  enabled: boolean
  settings: Record<string, any>
  installedAt?: number
}

/** 持久化存储结构 */
interface StorageData {
  version: number               // 配置结构版本，用于迁移
  plugins: Record<string, PluginConfigEntry>
}
```

### 2.2 localStorage 存储

```typescript
const STORAGE_KEY = 'confucius:plugin-config'

export class ConfigDB {
  /** 读取插件配置（合并默认值） */
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

  /** 设置启用状态 */
  setEnabled(pluginId: string, enabled: boolean): void {
    this.set(pluginId, { enabled })
  }

  /** 获取所有启用的插件 ID 列表 */
  getEnabledIds(): string[] {
    const all = this.load()
    return Object.entries(all)
      .filter(([, cfg]) => cfg.enabled !== false)
      .map(([id]) => id)
  }

  /** 获取所有已记录的插件 ID */
  getAllIds(): string[] {
    return Object.keys(this.load())
  }

  /** 删除插件配置 */
  remove(pluginId: string): void {
    const all = this.load()
    delete all[pluginId]
    this.save(all)
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
```

### 2.3 JSON Schema 配置（插件声明）

插件的 manifest.json 可声明配置项的结构，ConfigDB 用于渲染配置编辑器：

```json
{
  "id": "my-plugin",
  "name": "我的插件",
  "configSchema": {
    "type": "object",
    "properties": {
      "autoComplete": {
        "type": "boolean",
        "default": true,
        "description": "自动补全"
      },
      "maxResults": {
        "type": "number",
        "default": 50,
        "minimum": 1,
        "maximum": 500,
        "description": "最大结果数"
      }
    }
  }
}
```

---

## 3. SandboxFactory 增强（Proxy 隔离）

```typescript
// src/engine/SandboxFactory.ts

export class SandboxFactory {
  /** 白名单：插件可访问的全局 API */
  private static SAFE_GLOBALS = new Set([
    'console', 'JSON', 'Math', 'Date', 'Array', 'Object',
    'String', 'Number', 'Boolean', 'RegExp', 'Map', 'Set',
    'parseInt', 'parseFloat', 'encodeURI', 'decodeURI',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'isNaN', 'isFinite', 'Error', 'TypeError', 'RangeError',
    'null', 'undefined', 'true', 'false', 'NaN', 'Infinity',
  ])

  /** 黑名单：明确禁用的全局 API */
  private static BLOCKED_GLOBALS = new Set([
    'window', 'document', 'localStorage', 'sessionStorage',
    'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker',
    'indexedDB', 'crypto', 'location', 'navigator',
    'history', 'screen', 'alert', 'confirm', 'prompt',
    'requestAnimationFrame', 'cancelAnimationFrame',
    'open', 'close', 'focus', 'blur',
    'Event', 'CustomEvent', 'MutationObserver',
    'postMessage', 'addEventListener', 'removeEventListener',
  ])

  execute(code: string): Plugin {
    const sandbox = { module: { exports: {} as any }, exports: {} as any }

    // 创建 Proxy 拦截全局对象访问
    const handler: ProxyHandler<typeof globalThis> = {
      has: () => true,  // 让 'in' 检查不报错
      get: (target, prop) => {
        const key = String(prop)
        if (SandboxFactory.SAFE_GLOBALS.has(key)) {
          return (target as any)[key]
        }
        if (SandboxFactory.BLOCKED_GLOBALS.has(key)) {
          return undefined  // 返回 undefined 而非报错
        }
        // 默认阻止
        if (key.startsWith('__')) {
          return (target as any)[key]  // 允许内部属性
        }
        return undefined
      },
      set: () => {
        // 阻止修改全局对象
        return true
      },
    }

    const sandboxGlobal = new Proxy(globalThis, handler)
    const fn = new Function('module', 'exports', code)

    // 在沙箱全局上下文中执行
    fn.call(sandboxGlobal as any, sandbox.module, sandbox.exports)

    const plugin = sandbox.module.exports?.default || sandbox.module.exports
    if (!plugin?.manifest?.id) throw new Error('插件格式无效')

    return plugin
  }
}
```

### 沙箱拦截效果

```javascript
// 插件代码中的行为
typeof window           // → "undefined"
typeof document        // → "undefined"
typeof fetch           // → "undefined"
typeof localStorage    // → "undefined"
typeof console.log     // → "function"  （白名单）
typeof Math.random     // → "function"  （白名单）
typeof setTimeout      // → "function"  （白名单）
```

---

## 4. PluginEngine.start() 启动恢复

```typescript
// PluginEngine.ts 增量

export class PluginEngine {
  configDB: ConfigDB

  constructor(options: EngineOptions) {
    this.configDB = new ConfigDB()
    // ...
  }

  async start(): Promise<void> {
    // 1. 扫描发现的所有可用插件
    const available = await this.discoverPlugins()

    // 2. 读取上次启用的插件 ID
    const enabledIds = this.configDB.getEnabledIds()
    const toLoad = available.filter(p => enabledIds.includes(p.id))

    // 3. 注册并激活
    for (const pkg of toLoad) {
      await this.loadPackage(pkg)
    }

    // 4. 按依赖排序激活
    this.activateAll()
  }

  /** 外部加载插件后记录到配置 */
  loadExternalPlugin(code: string): { ok: boolean; error?: string } {
    try {
      const plugin = this.sandbox.execute(code)
      this.register(plugin)
      if (this.activate(plugin.manifest.id)) {
        // 记录启用状态
        this.configDB.setEnabled(plugin.manifest.id, true)
        return { ok: true }
      }
      return { ok: false, error: '激活失败' }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }
}
```

---

## 5. PluginManagerDialog 适配

```typescript
// 对话框新增功能
// 每个插件条目增加配置开关和配置项

function PluginItem({ plugin }: { plugin: PluginManifest }) {
  const config = pluginEngine.configDB.get(plugin.id)
  const [enabled, setEnabled] = useState(config.enabled)

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    pluginEngine.configDB.setEnabled(plugin.id, next)
    if (next) {
      pluginEngine.activate(plugin.id)
    } else {
      pluginEngine.deactivate(plugin.id)
    }
  }

  return (
    <div className="plugin-item">
      <div className="plugin-info">
        <span className="plugin-name">{plugin.name}</span>
        <label className="plugin-toggle">
          <input type="checkbox" checked={enabled} onChange={toggle} />
          启用
        </label>
      </div>
      {plugin.configSchema && (
        <PluginConfigEditor
          schema={plugin.configSchema}
          values={config.settings}
          onChange={(key, val) => {
            pluginEngine.configDB.set(plugin.id, { settings: { ...config.settings, [key]: val } })
          }}
        />
      )}
    </div>
  )
}
```

---

## 6. 文件变更清单

### 新增

```
src/engine/ConfigDB.ts       # 配置持久化
```

### 修改

```
src/engine/SandboxFactory.ts  # Proxy 隔离增强
src/engine/PluginEngine.ts   # start() 读取配置恢复
src/components/Settings/PluginManagerDialog.tsx  # 启用/禁用开关
```

---

## 7. 验收检查

- [ ] 加载外部插件 → 关闭应用 → 重启 → 插件自动加载
- [ ] 禁用插件 → 重启 → 不加载
- [ ] 插件代码中 `window === undefined`, `document === undefined`, `fetch === undefined`
- [ ] 插件代码中 `console.log`, `Math.random`, `setTimeout` 正常可用
- [ ] `localStorage.setItem('confucius:plugin-config', ...)` 存储格式正确
- [ ] 122 测试通过
