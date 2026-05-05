# 插件开发指南

## 快速开始

### 创建你的第一个插件

在 `~/.confucius/plugins/hello/` 目录下创建两个文件：

**manifest.json**
```json
{
  "id": "hello",
  "name": "Hello Plugin",
  "version": "1.0.0",
  "description": "在状态栏显示 Hello 文字"
}
```

**index.js**
```javascript
module.exports = {
  manifest: {
    id: 'hello',
    name: 'Hello Plugin',
    version: '1.0.0',
  },
  onActivate: function (ctx) {
    ctx.addStatusBarItem({
      id: 'hello-label',
      priority: 1,
      component: 'Hello Confucius',
    })
  },
  onDeactivate: function () {
    // 资源自动清理
  },
}
```

重启应用即可在状态栏看到 "Hello Confucius"。

---

## 插件格式

### manifest.json 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | ✅ | 唯一标识符 |
| `name` | ✅ | 显示名称 |
| `version` | ✅ | 语义版本，如 `1.0.0` |
| `apiVersion` | 可选 | 兼容的宿主 API 版本，如 `^1.0.0` |
| `entry` | 可选 | 入口文件，默认 `index.js` |
| `dependencies` | 可选 | 依赖的插件 ID 列表 |
| `permissions` | 可选 | 权限声明 |

### index.js 导出格式

```javascript
module.exports = {
  manifest: { id, name, version, ... },
  onActivate: function (ctx) { /* 注册 UI、监听事件 */ },
  onDeactivate: function () { /* 可选：手动清理 */ },
}
```

---

## API 参考

### ctx — PluginContext

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `ctx.getContent()` | 获取当前编辑器文本 | `string` |
| `ctx.getCursorPosition()` | 获取光标位置 | `{ line, col }` |
| `ctx.getActiveFilePath()` | 当前文件路径 | `string \| null` |
| `ctx.addStatusBarItem(item)` | 添加状态栏条目 | 移除函数 `() => void` |
| `ctx.addSidebarTab(tab)` | 添加侧边栏面板 | 移除函数 `() => void` |
| `ctx.addStyle(css)` | 注入 CSS | 移除函数 `() => void` |
| `ctx.onContentChange(cb)` | 监听内容变化 | 取消函数 `() => void` |
| `ctx.events.on(event, handler)` | 订阅事件 | 取消函数 `() => void` |
| `ctx.console.log/warn/error` | 安全版控制台 | — |

### 事件列表

| 事件名 | 触发时机 | payload |
|--------|---------|---------|
| `file:opened` | 打开文件 | `{ path }` |
| `file:saved` | 保存文件 | `{ path, content }` |
| `editor:content-change` | 编辑器内容变化 | `{ content }` |
| `theme:switched` | 主题切换 | `{ theme }` |
| `mode:switched` | 模式切换 | `{ mode }` |
| `app:ready` | 应用就绪 | — |
| `plugin:activated` | 其他插件激活 | `{ id }` |
| `plugin:deactivated` | 其他插件卸载 | `{ id }` |

---

## 完整示例：字数统计

```javascript
module.exports = {
  manifest: {
    id: 'word-count',
    name: '字数统计',
    version: '1.0.0',
    permissions: ['ui:statusbar'],
  },
  onActivate: function (ctx) {
    var currentContent = ''

    // 监听内容变化
    ctx.onContentChange(function (content) {
      currentContent = content
      updateDisplay()
    })

    // 注册状态栏条目
    ctx.addStatusBarItem({
      id: 'word-count',
      priority: 10,
      component: '字数: 0',
    })

    function updateDisplay() {
      var chineseChars = (currentContent.match(/[\u4e00-\u9fff]/g) || []).length
      var englishWords = currentContent
        .replace(/[\u4e00-\u9fff]/g, ' ')
        .split(/[\s,;.!?()]+/)
        .filter(Boolean).length
      var total = chineseChars + englishWords
      // 状态栏组件通过 addStatusBarItem 的 component 更新
      console.log('字数:', total)
    }
  },
}
```

---

## 最佳实践

- **资源清理**：`addStatusBarItem` / `addSidebarTab` / `addStyle` 返回的移除函数，引擎会在 `deactivate` 时自动调用，无需手动跟踪
- **错误隔离**：`onActivate` 中的异常不会崩溃宿主，但会记录到控制台
- **沙箱限制**：`window`、`document`、`fetch` 等全局 API 不可用；`console`、`Math`、`JSON` 可用
- **持久化配置**：使用 `localStorage` 存储插件配置（key 加插件 ID 前缀防冲突）

---

## 测试插件

### 单元测试（Vitest）

```typescript
// test/unit/engine/dependency-graph.test.ts 示例
import { DependencyGraph, CyclicDependencyError } from '../../src/engine/DependencyGraph'

describe('DependencyGraph', () => {
  test('拓扑排序', () => {
    const g = new DependencyGraph()
    g.add('A', ['B'])
    g.add('B', [])
    const result = g.resolveOrder(['A', 'B'])
    expect(result.indexOf('B')).toBeLessThan(result.indexOf('A'))
  })

  test('循环依赖抛出异常', () => {
    const g = new DependencyGraph()
    g.add('A', ['B'])
    g.add('B', ['A'])
    expect(() => g.resolveOrder(['A', 'B'])).toThrow(CyclicDependencyError)
  })
})
```

> 当前已有 27 个引擎模块测试用例规划（`EventBus`、`ConfigDB`、`SandboxFactory`、`Scanner`、`HostAPIBridgeImpl`），作为参考开发者可参照编写。
