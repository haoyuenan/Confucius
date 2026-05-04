# Phase 6 详细设计：测试与文档

**对应**：`docs/plugins/Development-Plan.md` Phase 6
**工时**：3h
**前置**：Phase 5 完成

---

## 1. 测试计划

### 1.1 新测试概览

| 模块 | 文件 | 用例数 | 类型 |
|------|------|--------|------|
| `DependencyGraph` | `test/unit/engine/dependency-graph.test.ts` | 6 | 单元 |
| `EventBus` | `test/unit/engine/event-bus.test.ts` | 5 | 单元 |
| `HostAPIBridgeImpl` | `test/unit/engine/host-api-bridge.test.ts` | 5 | 单元 |
| `Scanner` | `test/unit/engine/scanner.test.ts` | 3 | 单元 |
| `ConfigDB` | `test/unit/engine/config-db.test.ts` | 4 | 单元 |
| `SandboxFactory` | `test/unit/engine/sandbox-factory.test.ts` | 4 | 单元 |
| **合计** | **6 个文件** | **27** | |

### 1.2 DependencyGraph 测试（6 用例）

```typescript
// test/unit/engine/dependency-graph.test.ts

describe('DependencyGraph', () => {
  test('无依赖时返回原顺序', () => {
    const g = new DependencyGraph()
    g.add('A', [])
    g.add('B', [])
    expect(g.resolveOrder(['A', 'B'])).toEqual(['A', 'B'])
  })

  test('按依赖排序：被依赖方在前', () => {
    const g = new DependencyGraph()
    g.add('A', ['B'])
    g.add('B', [])
    const result = g.resolveOrder(['A', 'B'])
    expect(result.indexOf('B')).toBeLessThan(result.indexOf('A'))
  })

  test('多层依赖正确排序', () => {
    const g = new DependencyGraph()
    g.add('A', ['B'])
    g.add('B', ['C'])
    g.add('C', [])
    const result = g.resolveOrder(['A', 'B', 'C'])
    expect(result).toEqual(['C', 'B', 'A'])
  })

  test('循环依赖抛出异常', () => {
    const g = new DependencyGraph()
    g.add('A', ['B'])
    g.add('B', ['A'])
    expect(() => g.resolveOrder(['A', 'B'])).toThrow(CyclicDependencyError)
  })

  test('getMissing 返回缺失依赖', () => {
    const g = new DependencyGraph()
    g.add('A', ['B'])
    const registered = new Set<string>()
    expect(g.getMissing('A', registered)).toEqual(['B'])
  })

  test('remove 后依赖关系移除', () => {
    const g = new DependencyGraph()
    g.add('A', ['B'])
    g.remove('A')
    expect(g.getMissing('A', new Set())).toEqual([])
  })
})
```

### 1.3 EventBus 测试（5 用例）

```typescript
describe('EventBus', () => {
  test('订阅和发布', () => {
    const bus = new EventBus()
    const calls: string[] = []
    bus.on('test-plugin', 'file:saved', (p) => calls.push(p.path))
    bus.emit('file:saved', { path: '/a.md', content: 'x' })
    expect(calls).toEqual(['/a.md'])
  })

  test('多个订阅者各自收到事件', () => {
    const bus = new EventBus()
    const a: string[] = [], b: string[] = []
    bus.on('p1', 'file:saved', (p) => a.push(p.path))
    bus.on('p2', 'file:saved', (p) => b.push(p.path))
    bus.emit('file:saved', { path: '/a.md', content: 'x' })
    expect(a).toEqual(['/a.md'])
    expect(b).toEqual(['/a.md'])
  })

  test('removeAllByPlugin 清除指定插件的所有订阅', () => {
    const bus = new EventBus()
    const calls: string[] = []
    bus.on('p1', 'file:saved', (p) => calls.push(p.path))
    bus.on('p1', 'theme:switched', (p) => calls.push(p.theme))
    bus.removeAllByPlugin('p1')
    bus.emit('file:saved', { path: '/a.md', content: 'x' })
    expect(calls).toEqual([])
  })

  test('单个处理器异常不影响其他', () => {
    const bus = new EventBus()
    const calls: string[] = []
    bus.on('p1', 'file:saved', () => { throw new Error('err') })
    bus.on('p2', 'file:saved', (p) => calls.push(p.path))
    bus.emit('file:saved', { path: '/a.md', content: 'x' })
    expect(calls).toEqual(['/a.md'])
  })

  test('返回的取消函数可取消订阅', () => {
    const bus = new EventBus()
    const calls: string[] = []
    const unsub = bus.on('p1', 'file:saved', (p) => calls.push(p.path))
    unsub()
    bus.emit('file:saved', { path: '/a.md', content: 'x' })
    expect(calls).toEqual([])
  })
})
```

### 1.4 ConfigDB 测试（4 用例）

```typescript
describe('ConfigDB', () => {
  beforeEach(() => localStorage.clear())

  test('未配置时返回默认启用', () => {
    const db = new ConfigDB()
    expect(db.isEnabled('unknown')).toBe(true)
  })

  test('设置启用/禁用后正确读取', () => {
    const db = new ConfigDB()
    db.setEnabled('my-plugin', true)
    expect(db.isEnabled('my-plugin')).toBe(true)
    db.setEnabled('my-plugin', false)
    expect(db.isEnabled('my-plugin')).toBe(false)
  })

  test('getEnabledIds 只返回启用的', () => {
    const db = new ConfigDB()
    db.setEnabled('a', true)
    db.setEnabled('b', false)
    db.setEnabled('c', true)
    expect(db.getEnabledIds()).toEqual(['a', 'c'])
  })

  test('配置持久化到 localStorage', () => {
    const db1 = new ConfigDB()
    db1.setEnabled('my-plugin', false)
    const db2 = new ConfigDB()
    expect(db2.isEnabled('my-plugin')).toBe(false)
  })
})
```

### 1.5 SandboxFactory 测试（4 用例）

```typescript
describe('SandboxFactory', () => {
  test('正常插件代码执行成功', () => {
    const factory = new SandboxFactory()
    const code = `module.exports = { manifest: { id: 'test', name: 'T', version: '1.0.0' }, onActivate: function() {} }`
    const plugin = factory.execute(code)
    expect(plugin.manifest.id).toBe('test')
  })

  test('缺少 manifest.id 时抛出', () => {
    const factory = new SandboxFactory()
    const code = `module.exports = { manifest: {}, onActivate: function() {} }`
    expect(() => factory.execute(code)).toThrow()
  })

  test('缺少 onActivate 时抛出', () => {
    const factory = new SandboxFactory()
    const code = `module.exports = { manifest: { id: 'test', name: 'T', version: '1.0.0' } }`
    expect(() => factory.execute(code)).toThrow()
  })
})
```

---

## 2. 插件开发文档

### 2.1 文档结构

```
docs/plugins/
├── README.md                    ← 插件开发指南（本文）
├── Plugin-System.md             ← v1 插件系统设计
├── Plugin-Engine-v3-Roadmap.md  ← v3 重构方案
├── Development-Plan.md          ← 实施计划
└── design/                      ← 各 Phase 详细设计
    ├── Phase01-Engine-Decoupling.md
    ├── Phase02-Discovery.md
    ├── Phase03-Dependency-Events.md
    ├── Phase04-Config-Sandbox.md
    ├── Phase05-UI.md
    └── Phase06-Test-Docs.md
```

### 2.2 README.md 目录

```markdown
# 插件开发指南

## 快速开始
- 最简单的插件（10 行代码）
- 安装到应用

## 插件格式
- manifest.json 字段说明
- index.js 导出格式
- 支持的内置 API

## API 参考
- PluginContext 所有方法
- EventBus 事件列表
- HostAPIBridge 接口

## 权限系统
- 可用权限列表
- 声明方式
- 用户授权流程

## 最佳实践
- 资源清理
- 错误处理
- 性能注意事项
- 调试技巧

## 示例
- doc-stats：状态栏 + 动态标签
- status-bar-plus：时钟 + CSS 注入
```

---

## 3. 文件变更清单

### 新增

```
test/unit/engine/dependency-graph.test.ts   # 6 用例
test/unit/engine/event-bus.test.ts          # 5 用例
test/unit/engine/host-api-bridge.test.ts    # 5 用例
test/unit/engine/scanner.test.ts            # 3 用例
test/unit/engine/config-db.test.ts          # 4 用例
test/unit/engine/sandbox-factory.test.ts    # 4 用例
docs/plugins/README.md                      # 插件开发指南
```

### 修改

```
docs/plugins/Development-Plan.md            # 标记 Phase 6 完成
```

---

## 4. 验收检查

- [ ] 27 个新测试全部通过
- [ ] 总体测试数 122 + 27 = 149+
- [ ] `npm run test` 全部通过
- [ ] `npm run test:coverage` 覆盖报告无异常
- [ ] `docs/plugins/README.md` 覆盖：快速开始、API 参考、示例
- [ ] 新开发者根据 README 可在 5 分钟内创建并加载第一个插件
