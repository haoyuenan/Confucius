import type { Plugin } from './types/plugin'

const SAFE_GLOBALS = new Set([
  'console', 'JSON', 'Math', 'Date', 'Array', 'Object',
  'String', 'Number', 'Boolean', 'RegExp', 'Map', 'Set',
  'parseInt', 'parseFloat', 'encodeURI', 'decodeURI',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'isNaN', 'isFinite', 'Error', 'TypeError', 'RangeError',
  'null', 'undefined', 'true', 'false', 'NaN', 'Infinity',
])

const BLOCKED = new Set([
  'window', 'document', 'localStorage', 'sessionStorage',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker',
  'indexedDB', 'crypto', 'location', 'navigator',
  'history', 'screen', 'alert', 'confirm', 'prompt',
  'requestAnimationFrame', 'cancelAnimationFrame',
  'open', 'close', 'postMessage',
  'Event', 'CustomEvent', 'MutationObserver',
  'addEventListener', 'removeEventListener',
])

/**
 * SandboxFactory — 沙箱执行插件代码
 *
 * 使用 new Function 执行，通过 Proxy 拦截敏感全局 API。
 */
export class SandboxFactory {
  execute(code: string): Plugin {
    const sandbox = { module: { exports: {} as Partial<Plugin> }, exports: {} as Partial<Plugin> }

    const handler: ProxyHandler<typeof globalThis> = {
      has: () => true,
      get: (target, prop) => {
        const key = String(prop)
        if (SAFE_GLOBALS.has(key)) return (target as Record<string, unknown>)[key]
        if (BLOCKED.has(key)) return undefined
        if (key.startsWith('__')) return (target as Record<string, unknown>)[key]
        return undefined
      },
      set: () => true,
    }

    const sandboxGlobal = new Proxy(globalThis, handler)
    // 强制严格模式，阻止 (function(){return this})() 绕过 Proxy 获取真实 globalThis
    const strictCode = '"use strict";\n' + code
    const fn = new Function('module', 'exports', strictCode)
    fn.call(sandboxGlobal as unknown, sandbox.module, sandbox.exports)

    const plugin: Plugin = (sandbox.module.exports as { default?: Plugin })?.default || sandbox.module.exports as Plugin
    if (!plugin) throw new Error('module.exports 未定义')
    if (!plugin.manifest?.id) throw new Error('缺少 manifest.id')
    if (!plugin.onActivate) throw new Error('缺少 onActivate 方法')
    if (!plugin.onDeactivate) plugin.onDeactivate = () => {}

    return plugin
  }
}
