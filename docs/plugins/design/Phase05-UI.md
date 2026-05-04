# Phase 5 详细设计：插件 UI 完善

**对应**：`docs/plugins/Development-Plan.md` Phase 5
**工时**：4h
**前置**：Phase 4 完成

---

## 1. 设计目标

- 插件管理对话框改造：选项卡（已加载/可用/已禁用）
- "打开插件目录"按钮 → 在系统文件管理器中打开
- 批量扫描目录，发现未加载的插件
- 插件详情面板（权限、版本、描述、配置项）
- 示例插件整理到 `plugins/examples/`

---

## 2. 对话框改造

### 2.1 布局

```
┌─────────────────────────────────────────────┐
│  插件管理                                ✕  │
├─────────────────────────────────────────────┤
│  [已加载 (3)]  [可用 (2)]  [已禁用 (1)]     │ ← 选项卡
├─────────────────────────────────────────────┤
│  ┌─ 状态栏信息 ───────────────────────────┐ │
│  │  v1.1.0  │ 显示字数、光标位置...     ▼ │ │
│  │  [● 启用]  [详情]                      │ │
│  ├────────────────────────────────────────┤ │
│  │  详情展开时：                           │ │
│  │  ├ ID: builtin:status-bar              │ │
│  │  ├ 权限: ui:statusbar                  │ │
│  │  ├ 作者: 系统内置                      │ │
│  │  └ 目录: plugins/builtins/status-bar/  │ │
│  ├────────────────────────────────────────┤ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌─ 文档统计 (可用) ──────────────────────┐ │
│  │  v1.0.0  │ 状态栏显示字数/阅读时间     │ │
│  │  [加载] [详情]                         │ │
│  └────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│  [打开插件目录]          [加载插件...]      │
└─────────────────────────────────────────────┘
```

### 2.2 组件结构

```typescript
// PluginManagerDialog.tsx

type TabType = 'loaded' | 'available' | 'disabled'

function PluginManagerDialog({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('loaded')
  const [plugins, setPlugins] = useState<PluginWithStatus[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // PluginWithStatus 结构
  // { manifest, status: 'active'|'inactive'|'available', path, config }
}
```

### 2.3 打开插件目录

```typescript
// 通过 IPC 在文件管理器中打开目录
const handleOpenDir = async () => {
  // 使用已有的 revealInExplorer API
  await bridge.revealInExplorer(pluginDir)
}

// 需要新增 IPC: dialog:open-plugin-dir
// 或复用 existing revealInExplorer
```

---

## 3. 可用插件发现

```typescript
// PluginEngine 新增方法

/** 扫描目录并返回尚未加载的插件 */
async findAvailablePlugins(): Promise<PluginPackage[]> {
  const dirs = this.options.userDir
    ? [this.options.builtinDir, this.options.userDir]
    : [this.options.builtinDir]

  const all = await Promise.all(dirs.map(d => this.scanner.scanDirectory(d)))
  const flat = all.flat()

  // 排除已注册的
  const registeredIds = new Set(this.registry.keys())
  return flat.filter(p => !registeredIds.has(p.id))
}
```

---

## 4. 插件详情面板

```typescript
function PluginDetail({ plugin }: { plugin: PluginWithStatus }) {
  return (
    <div className="plugin-detail">
      <div className="detail-row">
        <span className="detail-label">ID</span>
        <span className="detail-value">{plugin.manifest.id}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">版本</span>
        <span className="detail-value">v{plugin.manifest.version}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">API 版本</span>
        <span className="detail-value">{plugin.manifest.apiVersion || '任意'}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">权限</span>
        <span className="detail-value">
          {(plugin.manifest.permissions || ['无']).join(', ')}
        </span>
      </div>
      <div className="detail-row">
        <span className="detail-label">目录</span>
        <span className="detail-value detail-path">{plugin.path || '—'}</span>
      </div>
      {plugin.manifest.dependencies && plugin.manifest.dependencies.length > 0 && (
        <div className="detail-row">
          <span className="detail-label">依赖</span>
          <span className="detail-value">{plugin.manifest.dependencies.join(', ')}</span>
        </div>
      )}
    </div>
  )
}
```

---

## 5. 样式增量

```css
/* dialog.css 新增 */

.plugin-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
}

.plugin-tab {
  flex: 1;
  height: 36px;
  border: none;
  background: transparent;
  font-size: 13px;
  cursor: pointer;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
}
.plugin-tab.active {
  color: var(--accent-color);
  border-bottom-color: var(--accent-color);
}

.plugin-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.plugin-detail {
  padding: 8px 18px 12px;
  background: var(--bg-secondary);
  margin: 0 18px 8px;
  border-radius: 6px;
  font-size: 12px;
}

.detail-row {
  display: flex;
  padding: 2px 0;
}
.detail-label {
  width: 60px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.detail-value {
  color: var(--text-secondary);
}
.detail-path {
  font-family: monospace;
  font-size: 11px;
  word-break: break-all;
}
```

---

## 6. 示例插件整理

```
plugins/examples/
├── doc-stats/
│   ├── manifest.json
│   ├── index.js
│   └── README.md
│
└── status-bar-plus/
    ├── manifest.json
    ├── index.js
    └── README.md
```

---

## 7. 文件变更清单

### 新增

```
plugins/examples/README.md     # 示例插件说明
```

### 修改

```
src/components/Settings/PluginManagerDialog.tsx  # 选项卡 + 详情 + 目录按钮
src/styles/dialog.css          # 插件管理专用样式
src/engine/PluginEngine.ts     # findAvailablePlugins()
```

---

## 8. 验收检查

- [ ] 插件管理对话框有 3 个选项卡：已加载 / 可用 / 已禁用
- [ ] 可用选项卡显示目录中存在但未加载的插件
- [ ] 点击"加载"→ 插件移入已加载列表
- [ ] 点击"禁用"→ 插件移入已禁用列表
- [ ] 点击插件展开详情（ID、版本、权限、路径）
- [ ] "打开插件目录" → 文件管理器打开插件目录
- [ ] 122 测试通过
