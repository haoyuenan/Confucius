# Phase 2 详细设计：目录化与自动发现

**对应**：`docs/plugins/Development-Plan.md` Phase 2
**工时**：2h
**前置**：Phase 1 完成

---

## 1. 设计目标

- 内置插件从 `src/plugins/builtins/` 移入 `plugins/builtins/` 目录
- `Scanner` 模块自动扫描目录，发现插件
- `SandboxFactory` 安全执行插件代码
- 删除 `App.tsx` 中所有手动 `registerBuiltins` 调用

---

## 2. 目录结构

```
plugins/builtins/                    ← Vite 打包时复制到 dist/
├── status-bar/                      ← 每个插件独立子目录
│   ├── manifest.json
│   └── index.js                     ← 编译产物（.ts → .js）

~/.confucius/plugins/                ← Electron 运行时扫描
└── doc-stats/
    ├── manifest.json
    └── index.js
```

### manifest.json 格式

```json
{
  "id": "status-bar",
  "name": "状态栏信息",
  "version": "1.1.0",
  "apiVersion": "^1.0.0",
  "entry": "index.js",
  "description": "显示字数、光标位置、文件信息、编辑模式",
  "permissions": ["ui:statusbar"]
}
```

---

## 3. Scanner 模块

```typescript
// src/engine/Scanner.ts

export interface PluginPackage {
  id: string
  name: string
  version: string
  apiVersion?: string
  entryPath: string           // JS 入口文件绝对路径
  manifestPath: string        // manifest.json 绝对路径
  description?: string
  permissions?: string[]
}

export class Scanner {
  /**
   * 扫描指定目录，返回发现的插件包列表
   * 规则：每个子目录下有 manifest.json 的子目录视为一个插件
   */
  async scanDirectory(dirPath: string): Promise<PluginPackage[]> {
    const result: PluginPackage[] = []

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (entry.name.startsWith('.')) continue  // 跳过隐藏目录
        if (entry.name === 'disabled') continue   // 跳过禁用目录

        const pkg = await this.loadManifest(path.join(dirPath, entry.name))
        if (pkg) result.push(pkg)
      }
    } catch { /* 目录不存在时静默跳过 */ }

    return result
  }

  /** 读取并验证单个插件目录的 manifest.json */
  private async loadManifest(pluginDir: string): Promise<PluginPackage | null> {
    const manifestPath = path.join(pluginDir, 'manifest.json')
    const entryPath = path.join(pluginDir, 'index.js')

    try {
      const content = await fs.readFile(manifestPath, 'utf-8')
      const json = JSON.parse(content)

      // 必填字段校验
      if (!json.id || !json.name || !json.version) {
        console.warn(`插件目录 ${pluginDir} manifest.json 缺少必填字段`)
        return null
      }

      // 入口文件存在性校验
      const entryExists = await fs.stat(entryPath).then(() => true).catch(() => false)
      if (!entryExists) {
        console.warn(`插件 ${json.id} 缺少入口文件 index.js`)
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
```

**关键设计决策**：使用 Electron 主进程的 `fs` 模块扫描目录，通过 IPC 将结果传递到渲染进程。Scanner 在主进程运行，避免渲染进程直接访问文件系统。

### IPC 通道

```
渲染进程 → 主进程: 'scanner:scan' (dirPath: string)
主进程 → 渲染进程: PluginPackage[]

渲染进程 → 主进程: 'scanner:read-entry' (entryPath: string)
主进程 → 渲染进程: { code: string }
```

---

## 4. SandboxFactory 模块

```typescript
// src/engine/SandboxFactory.ts

export class SandboxFactory {
  /**
   * 在沙箱中执行插件代码，返回 Plugin 实例
   *
   * @param code 插件 JS 源码（module.exports 格式）
   * @returns Plugin 实例
   * @throws 代码执行失败时抛出
   */
  execute(code: string): Plugin {
    const sandbox = { module: { exports: {} as any }, exports: {} as any }

    // 使用 new Function 创建执行环境
    // module 和 exports 作为参数注入
    const fn = new Function('module', 'exports', code)
    fn(sandbox.module, sandbox.exports)

    // 兼容 ESM default export 和 CJS exports
    const plugin: Plugin =
      sandbox.module.exports?.default || sandbox.module.exports

    // 格式校验
    if (!plugin) throw new Error('module.exports 未定义')
    if (!plugin.manifest?.id) throw new Error('缺少 manifest.id')
    if (!plugin.onActivate) throw new Error('缺少 onActivate 方法')

    return plugin
  }
}
```

---

## 5. PluginEngine.start() 集成

```typescript
// PluginEngine.ts 新增

import { Scanner, type PluginPackage } from './Scanner'
import { SandboxFactory } from './SandboxFactory'

export interface EngineOptions {
  bridge: HostAPIBridge
  builtinDir: string       // 内置插件目录
  userDir?: string         // 用户插件目录（可选）
}

export class PluginEngine {
  private scanner: Scanner
  private sandbox: SandboxFactory

  constructor(private options: EngineOptions) {
    this.scanner = new Scanner()
    this.sandbox = new SandboxFactory()
  }

  /** 启动引擎：扫描 → 加载 → 激活 */
  async start(): Promise<void> {
    // 1. 扫描内置插件目录
    const builtins = await this.scanner.scanDirectory(this.options.builtinDir)

    // 2. 扫描用户插件目录
    const userPlugins = this.options.userDir
      ? await this.scanner.scanDirectory(this.options.userDir)
      : []

    // 3. 加载并注册
    const allPackages = [...builtins, ...userPlugins]
    for (const pkg of allPackages) {
      await this.loadPackage(pkg)
    }

    // 4. 激活所有（依赖排序将在 Phase 3 加入）
    this.activateAll()
  }

  private async loadPackage(pkg: PluginPackage): Promise<boolean> {
    try {
      // 通过 IPC 读取入口文件
      const result = await window.electronAPI.readPluginEntry(pkg.entryPath)
      const plugin = this.sandbox.execute(result.code)
      this.register(plugin)
      return true
    } catch (err) {
      console.error(`加载插件 ${pkg.id} 失败:`, err)
      return false
    }
  }
}
```

---

## 6. 内置插件编译

由于 `plugins/builtins/` 需要 `.js` 格式（Plain JS，无 JSX/TS），内置插件需要从 `.tsx` 编译为 `.js`。

### 方案 A：手动编译（推荐）

```bash
# 使用 esbuild 编译 .tsx → .js
npx esbuild src/plugins/builtins/status-bar-info.tsx \
  --bundle --format=cjs --platform=browser \
  --outfile=plugins/builtins/status-bar/index.js
```

### 方案 B：Vite 构建时复制

```typescript
// vite.config.mts（未来）
import copy from 'vite-plugin-copy'

plugins: [
  copy({
    targets: [
      { src: 'src/plugins/builtins/*/index.js', dest: 'plugins/builtins/' },
    ],
  }),
]
```

---

## 7. 文件变更清单

### 新增

```
src/engine/Scanner.ts          # 目录扫描器
src/engine/SandboxFactory.ts   # 沙箱执行器
```

### 修改

```
src/engine/PluginEngine.ts     # 新增 start()、loadPackage()
electron/ipc-handlers.ts       # 新增 scanner:scan / scanner:read-entry IPC
electron/preload.ts            # 暴露 readPluginEntry API
src/types/electron.d.ts        # 补充类型
src/App.tsx                    # 调用 engine.start() 替代 registerBuiltins
```

### 移动

```
src/plugins/builtins/status-bar-info.tsx → plugins/builtins/status-bar/index.js
```

---

## 8. 验收检查

- [ ] 删除 `App.tsx` 所有 `registerBuiltins` 调用后，重启应用状态栏仍正常
- [ ] `plugins/builtins/status-bar/` 目录存在 `manifest.json` + `index.js`
- [ ] 在 `~/.confucius/plugins/` 放入 doc-stats 插件 → 重启后自动加载
- [ ] manifest.json 缺少 `id` 字段 → 跳过并警告
- [ ] 入口文件不存在 → 跳过并警告
- [ ] 122 测试通过
