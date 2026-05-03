# Phase06 详细设计：多标签页 (Tabs)

**计划周期**：第 17 周  
**前置依赖**：Phase 1-5 全部完成  
**阶段目标**：实现多标签页支持，允许同时打开多个文件，以标签形式切换，保留每个标签独立的编辑状态和滚动位置。

---

## 1. 设计原则

**最小改动**：以最小代码变更实现核心功能，不重构已有 Store 架构，新增 store 作为上游数据源。

**向后兼容**：已有 `app-store` / `editor-store` 保持不变，tab store 在上层协调数据流。

**无外部依赖**：不新增 npm 包，纯 Zustand + React 实现。

---

## 2. 核心数据模型

### 2.1 Tab 接口

```typescript
// src/stores/tab-store.ts

export interface TabData {
  /** 标签唯一 ID */
  id: string
  /** 文件路径（null 表示未命名新文件） */
  filePath: string | null
  /** 显示的文件名 */
  fileName: string
  /** 当前编辑器内容 */
  content: string
  /** 上次保存时的内容快照 */
  savedContent: string
  /** 是否有未保存修改 */
  isModified: boolean
  /** 编辑器滚动位置（用于切换 tab 时恢复） */
  scrollTop: number
}
```

### 2.2 TabStore 状态

```typescript
interface TabState {
  /** 所有已打开的标签 */
  tabs: TabData[]
  /** 当前激活标签的 ID */
  activeTabId: string | null
  /** 自增 ID 计数器 */
  nextId: number

  // ── 查询 ──
  /** 活跃标签的 TabData */
  activeTab: TabData | null

  // ── 动作 ──
  /** 打开文件：已打开则切换到该 tab，否则新建 */
  openFile: (filePath: string, content: string) => string
  /** 新建未命名标签 */
  newUntitledTab: () => string
  /** 切换到指定标签 */
  activateTab: (tabId: string) => void
  /** 关闭标签（含未保存检查） */
  closeTab: (tabId: string) => Promise<boolean>
  /** 更新指定标签的内容 */
  updateContent: (tabId: string, content: string) => void
  /** 标记标签已保存 */
  markTabSaved: (tabId: string) => void
  /** 保存标签的滚动位置 */
  saveScrollTop: (tabId: string, scrollTop: number) => void
  /** 获取指定标签 */
  getTab: (tabId: string) => TabData | undefined
}
```

---

## 3. 架构变更

### 3.1 数据流变化

```
目前（单文件）：                      Tab 模式：
                                     ┌──────────────────┐
  fileTree → appStore → editorStore   │ tab-store.ts      │
                                         │ tabs: [{id,path,  │
                                         │   content,...},...]│
                                         │ activeTabId       │
                                         └────────┬─────────┘
                                                   │
                                ┌──────────────────┼──────────────────┐
                                ▼                  ▼                  ▼
                          app-store.ts       editor-store.ts      EditorPane
                          (title bar)        (CM6 content)        (编辑器)
```

- `tab-store.ts` 是上游数据源
- 切换 tab 时：tab store 将活跃 tab 的 content 写入 `editor-store.content`
- 编辑时：`editor-store.setContent` → 上层同步到 `tab-store.updateContent`
- 保存时：`tab-store.markTabSaved` 更新对应 tab 的 `savedContent`

### 3.2 同步策略

```typescript
// EditorLayout.tsx —— 内容同步（简化版）
// 读取：tabStore.activeTab.content → editorStore.content 已由 activateTab 写入
// 写入：EditorPane.onContentChange → editorStore.setContent → useEffect → tabStore.updateContent

// activateTab 时序：
// 1. 保存当前 tab 的 scrollTop
// 2. 更新 activeTabId
// 3. 将新 tab 的 content 写入 editorStore.setContent(newContent)
// 4. 将新 tab 的 scrollTop → 通过自定义事件或 ref 恢复滚动
```

---

## 4. 组件层次结构

```
App.tsx
├── TitleBar
│   └── (改用 tab store 读取文件名和修改状态)
├── Sidebar
│   ├── FileTreePanel → tabStore.openFile()
│   ├── OutlinePanel → 不变
│   └── SearchPanel → tabStore.openFile()
├── EditorLayout
│   ├── TabBar（新增）
│   │   ├── Tab 列表（可滚动）
│   │   ├── 每个 Tab：图标 + 文件名 + 修改标记(●) + 关闭按钮(✕)
│   │   └── 新标签按钮(+)
│   ├── FormatToolbar（不变）
│   └── EditorContent
│       ├── EditorPane（依活跃 tab 显示内容）
│       └── PreviewPane（依活跃 tab 显示内容）
└── ModeSwitch（不变）
```

---

## 5. 组件设计

### 5.1 TabBar 组件

```tsx
// src/components/Editor/TabBar.tsx

function TabBar() {
  const tabs = useTabStore(s => s.tabs)
  const activeTabId = useTabStore(s => s.activeTabId)
  const activateTab = useTabStore(s => s.activateTab)
  const closeTab = useTabStore(s => s.closeTab)
  const newUntitledTab = useTabStore(s => s.newUntitledTab)

  return (
    <div className="tab-bar">
      <div className="tab-list">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab-item ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => activateTab(tab.id)}
          >
            {/* 文件类型图标 */}
            <span className="tab-icon">📄</span>
            {/* 文件名 */}
            <span className="tab-name">{tab.fileName}</span>
            {/* 未保存标记 */}
            {tab.isModified && <span className="tab-modified">●</span>}
            {/* 关闭按钮 */}
            <button
              className="tab-close"
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      {/* 新建标签按钮 */}
      <button className="tab-new-btn" onClick={newUntitledTab} title="新建标签">
        +
      </button>
    </div>
  )
}
```

### 5.2 EditorLayout 改动

```tsx
// EditorLayout.tsx —— 修改点

function EditorLayout() {
  const activeTab = useTabStore(s => s.activeTab)
  const updateContent = useTabStore(s => s.updateContent)
  const activeTabId = useTabStore(s => s.activeTabId)
  const saveScrollTop = useTabStore(s => s.saveScrollTop)

  const mode = useEditorStore(s => s.mode)
  const focusMode = useEditorStore(s => s.focusMode)
  const typewriterMode = useEditorStore(s => s.typewriterMode)

  // 专注模式
  toggleFocusMode(getActiveView(), focusMode)

  const content = activeTab?.content ?? ''
  const setContent = useCallback((c: string) => {
    if (activeTabId) updateContent(activeTabId, c)
  }, [activeTabId, updateContent])

  const paneProps = {
    initialContent: content,
    onContentChange: setContent,
    enableTypewriter: focusMode && typewriterMode,
  }

  return (
    <div className="editor-area">
      <TabBar />
      <FormatToolbar />
      <div className="editor-content">
        {mode === 'wysiwyg' ? (
          <div className="wysiwyg-layout" style={{ height: '100%' }} key="wysiwyg-container">
            <EditorPane key={`cm6-${activeTabId}`} {...paneProps} enableWysiwyg />
          </div>
        ) : (
          <div className="split-pane" key="split-container">
            <ResizablePane defaultWidth="50%" minWidth={250}>
              <EditorPane key={`cm6-${activeTabId}`} {...paneProps} />
            </ResizablePane>
            <div className="split-divider" />
            <div className="preview-wrapper">
              <PreviewPane content={content} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

**关键改动**：
- `EditorPane` 的 `key` 从 `"cm6-split"` / `"cm6-wysiwyg"` 改为 `` `cm6-${activeTabId}` ``，切换 tab 时 CM6 实例重建
- 内容来源从 `editorStore.content` 改为 `activeTab.content`
- `onContentChange` 写入 `tabStore.updateContent`

### 5.3 App.tsx 改动

标题栏 + 打开/保存/新建操作改用 tab store：

```tsx
// 标题栏
const activeTab = useTabStore(s => s.activeTab)

;<header className="app-titlebar">
  <span className="app-title">
    {activeTab ? <>{activeTab.fileName}{activeTab.isModified && <span className="modified-dot"> ●</span>}</> : 'Confucius'}
  </span>
  <span className="app-version">v{version || '...'}</span>
</header>

// 保存：读取 tab store 的 activeTab
const handleSaveFile = useCallback(async () => {
  const tab = useTabStore.getState().activeTab
  if (tab?.filePath && tab?.content !== undefined) {
    try {
      await window.electronAPI.writeFile(tab.filePath, tab.content)
      useTabStore.getState().markTabSaved(tab.id)
    } catch (err) { console.error(err) }
  }
}, [])
```

---

## 6. 打开/保存/关闭流程

### 6.1 打开文件（FileTreePanel / SearchPanel）

```
FileTreePanel.handleFileClick(node)
     │
     ▼
读取文件内容 readFile(node.path)
     │
     ▼
tabStore.openFile(filePath, content)
     ├─ 已打开 → 切换到该 tab（activateTab）
     └─ 未打开 → createTab(...) → activateTab

activateTab(tabId)
     ├─ 旧 tab: saveScrollTop (记录滚动)
     ├─ 新 tab: editorStore.setContent(tab.content)
     └─ 新 tab: 通过 key 重建 CM6 (内容自动恢复)
```

### 6.2 关闭标签

```
closeTab(tabId)
     │
     ├─ tab.isModified === false → 直接移除
     │
     └─ tab.isModified === true
           ├─ confirmSave()
           │   ├─ 保存 → writeFile → 移除
           │   ├─ 不保存 → 移除
           │   └─ 取消 → 中止
           │
           ▼
     移除后：tabs 为空 → autoNewTab()
             tabs 不空 → activateTab(相邻tab)
```

### 6.3 保存文件

```
handleSaveFile()
     │
     ▼
activeTab = getState().activeTab
     │
     ▼
activeTab.filePath === null
     ├─ true → saveFileDialog() 选择路径 → writeFile → markTabSaved
     └─ false → writeFile(filePath, content) → markTabSaved
```

---

## 7. 未保存检查迁移

当前 `app-store.ts` 管理 `isModified` 和 `savedContent`。Tab 模式下，`tab-store.ts` 的每个 tab 自带这些字段：

| 旧位置 | 新位置 | 迁移方式 |
|--------|--------|---------|
| `appStore.currentFilePath` | `activeTab.filePath` | tab store 管理 |
| `appStore.savedContent` | `tab.savedContent` | 每个 tab 独立 |
| `appStore.isModified` | `tab.isModified` | 每个 tab 独立 |
| `editorStore.content` | 保留，由 activeTab.content 同步写入 | 读→tab，写→tab 同步到 editorStore |

**现有字段保留**：`appStore.currentFilePath` 等现有字段保持不动，但不再作为主数据源。`tab-store` 接管后，编辑器组件从 `tab-store` 读取数据。

---

## 8. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/stores/tab-store.ts` | **新建** | Tab 数据模型 + 所有 CRUD 动作 |
| `src/components/Editor/TabBar.tsx` | **新建** | Tab 列表 + 新建关闭按钮 |
| `src/styles/tab-bar.css` | **新建** | Tab 栏完整样式 |
| `src/components/Editor/EditorLayout.tsx` | **修改** | 添加 TabBar，内容来源改为 tab store |
| `src/components/Editor/EditorPane.tsx` | **修改** | 暴露 tooltip/scroll 用于当前 tab 恢复 |
| `src/App.tsx` | **修改** | 标题栏/保存/新建/打开操作切换到 tab store |
| `src/components/Sidebar/FileTreePanel.tsx` | **修改** | `handleFileClick` 改为 `tabStore.openFile()` |
| `src/components/Sidebar/SearchPanel.tsx` | **修改** | `handleResultClick` 同上 |
| `src/main.tsx` | **修改** | 导入 `tab-bar.css` |

---

## 9. 样式设计要点

```css
/* tab-bar.css — 核心样式 */

.tab-bar {
  display: flex;
  align-items: center;
  height: 36px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.tab-list {
  display: flex;
  flex: 1;
  gap: 0;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  border-right: 1px solid var(--border-color);
  white-space: nowrap;
  user-select: none;
  transition: background 0.1s;
  min-width: 0;
}

.tab-item:hover {
  background: var(--bg-primary);
}

.tab-item.active {
  background: var(--bg-primary);
  color: var(--text-primary);
  border-bottom: 2px solid var(--accent-color);
}

.tab-close {
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 10px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.1s;
}

.tab-item:hover .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.tab-new-btn {
  width: 30px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 16px;
  flex-shrink: 0;
}

.tab-new-btn:hover {
  color: var(--text-primary);
  background: var(--bg-primary);
}
```

---

## 10. 验收标准

| 验收项 | 条件 |
|--------|------|
| 多标签显示 | 打开多个文件后，每个文件对应一个标签，文件名正确显示 |
| 标签切换 | 点击标签切换到对应文件，编辑器内容正确切换 |
| 文件树打开 | 点击文件树中的 .md 文件 → 新建标签或切换到已有标签 |
| 搜索结果打开 | 点击搜索结果 → 同上 |
| 未保存标记 | 修改内容后标签上显示 `●`，保存后消失 |
| 关闭标签 | 点击 ✕ 关闭标签，未保存时弹出确认对话框 |
| 全部关闭行为 | 关闭最后一个标签时自动新建一个未命名空标签 |
| 新建标签 | 点击 `+` 新建未命名标签 |
| 标题栏联动 | 标题栏显示当前活跃标签的文件名 + 修改标记 |
| 保存文件 | Ctrl+S 保存当前标签的内容到对应文件路径 |
| 滚动保持 | 切换标签后切回，编辑器的滚动位置恢复 |
| CM6 重建 | 切换标签时 `key={activeTabId}` 确保 CM6 正确重建 |

---

## 11. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| CM6 重建丢失 undo 历史 | 标签切换后撤销栈清空 | 这是预期行为 — 每个标签独立编辑，CM6 实例重建是为了隔离状态 |
| 大量标签（>20）性能 | 标签栏拥挤 | tab-bar 设置 `overflow-x: auto`，支持水平滚动 |
| 同步时序问题 | content 不一致 | `activateTab` 先保存旧 tab 的 scroll/content，再加载新 tab |
| 与现有 app-store 数据不一致 | 标题栏/保存读取错误 | tab store 作为唯一真实数据源，app-store 字段降级为兼容保留 |
