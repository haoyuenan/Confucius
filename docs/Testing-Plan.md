# 测试方案与实施计划

**版本**：v1.1  
**日期**：2026-05-03  
**当前状态**：✅ Phase 1-4 已完成，121 测试全部通过，20 个测试文件

---

## 1. 测试策略总览

```
测试金字塔（Electron 桌面应用）
         ┌──────────┐
         │  E2E     │  ← Playwright + Electron
         │   (10%)  │
        ┌┼──────────┼┐
        │ 集成测试   │  ← React Testing Library + Vitest
        │   (30%)   │
       ┌┼────────────┼┐
       │  单元测试    │  ← Vitest
       │    (60%)    │
       └──────────────┘
```

**工具链**：

| 用途 | 工具 | 理由 |
|------|------|------|
| 测试运行器 | Vitest | 与 Vite 共享配置，原生 TypeScript/ESM 支持 |
| React 组件测试 | @testing-library/react | 用户行为驱动，不耦合实现细节 |
| IPC Mock | `test/setup.ts` | 全量 mock `window.electronAPI`，Node 环境加 `typeof window` 守卫 |
| E2E | Playwright + Electron | 计划在第 5 周实施 |
| 覆盖率 | @vitest/coverage-v8 | V8 引擎原生覆盖率（阈值 70%） |

---

## 2. 测试环境搭建

### 2.1 安装依赖

```bash
# 测试运行器 + React 测试库
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# 覆盖率
npm install --save-dev @vitest/coverage-v8

# Mock
npm install --save-dev vitest-mock-extended

# E2E
npm install --save-dev @playwright/test electron-playwright

# DOM 类型扩展
npm install --save-dev @types/testing-library__jest-dom
```

### 2.2 Vitest 配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'test/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/main.tsx', 'src/vite-env.d.ts'],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

### 2.3 测试目录结构（当前状态）

```
test/
├── setup.ts                # ✅ 全局 setup（jsdom 适配、mock window.electronAPI + Node 环境守卫）
│
├── unit/
│   ├── stores/             ✅ [39 cases]
│   │   ├── tab-store.test.ts          (12 cases)
│   │   ├── editor-store.test.ts       (9 cases)
│   │   ├── app-store.test.ts          (8 cases)
│   │   └── sidebar-store.test.ts      (10 cases)
│   ├── editor/
│   │   ├── format-helpers.test.ts ✅   (23 cases)
│   │   ├── markdown-renderer.test.ts  📋 待实施
│   │   ├── wysiwyg-plugin.test.ts     📋 待实施
│   │   ├── outline-parser.test.ts     📋 待实施
│   │   └── mermaid-renderer.test.ts   📋 待实施
│   ├── utils/              ✅ [16 cases]
│   │   ├── sanitize.test.ts           (6 cases)
│   │   ├── dom-diff.test.ts           (3 cases)
│   │   ├── path.test.ts               (4 cases)
│   │   └── large-file-handler.test.ts (3 cases)
│   └── services/           ✅ [11 cases]
│       ├── theme-service.test.ts      (5 cases)
│       └── encoding-detector.test.ts  (6 cases)
│
├── integration/
│   ├── components/         ✅ [22 cases]
│   │   ├── TabBar.test.tsx            (5 cases)
│   │   ├── FormatToolbar.test.tsx     (5 cases)
│   │   ├── FileTreePanel.test.tsx     (3 cases)
│   │   ├── SearchPanel.test.tsx       (3 cases)
│   │   ├── PreviewPane.test.tsx       (3 cases)
│   │   └── ThemeSelector.test.tsx     (3 cases)
│   └── flows/              ✅ [10 cases]
│       ├── file-open-flow.test.ts     (4 cases)
│       ├── tab-switch-flow.test.ts    (3 cases)
│       └── theme-switch-flow.test.ts  (3 cases)
│
└── e2e/                   📋 计划第 5 周
    ├── editor.spec.ts
    ├── file-operations.spec.ts
    ├── sidebar.spec.ts
    └── export.spec.ts
```

### 已实现的 npm 脚本

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

### 2.4 当前实际 Setup 代码

```typescript
// test/setup.ts
import '@testing-library/jest-dom'

const createNoop = () => () => {}
const createPromiseNoop = () => Promise.resolve()

const mockElectronAPI = {
  getVersion: () => Promise.resolve('1.0.0'),
  openFileDialog: () => Promise.resolve(null),
  saveFileDialog: () => Promise.resolve(null),
  readFile: (_path: string) => Promise.resolve({ content: `# File: ${_path}`, filePath: _path }),
  writeFile: createPromiseNoop,
  confirmSave: () => Promise.resolve(1 as 0 | 1 | 2),
  onMenuAction: () => createNoop() as () => void,
  openFolderDialog: () => Promise.resolve(null),
  buildFileTree: () => Promise.resolve({ name: 'root', path: '/root', type: 'directory' as const, children: [] }),
  startFileWatcher: createPromiseNoop,
  stopFileWatcher: createPromiseNoop,
  onFileTreeChanged: () => createNoop() as () => void,
  showSidebarContextMenu: createPromiseNoop,
  onSidebarAction: () => createNoop() as () => void,
  createFile: () => Promise.resolve(true),
  createDir: () => Promise.resolve(true),
  renameItem: createPromiseNoop,
  deleteItem: createPromiseNoop,
  revealInExplorer: createPromiseNoop,
  searchQuery: () => Promise.resolve([]),
  exportHtml: createPromiseNoop,
  exportPdf: createPromiseNoop,
  onExportDone: () => createNoop() as () => void,
}

// 保护 Node 环境（encoding-detector 等测试用 @vitest-environment node）
if (typeof window !== 'undefined') {
  ;(window as any).electronAPI = mockElectronAPI
  ;(window as any).__exportPreviewHTML__ = () => ''
}
```

**重要**：encoding-detector 测试需在文件首行加 `// @vitest-environment node` 来覆盖默认的 jsdom 环境。

---

## 3. 测试用例设计

### 3.1 单元测试

#### 3.1.1 Store 层（优先级 P0）

| 测试 | 模块 | 用例数 | 核心用例 |
|------|------|--------|---------|
| tab-store | `src/stores/tab-store.ts` | 12 | ✅ 通过 | openFile 已存在→切换；openFile 新文件→创建+激活；closeTab 未修改→直接删除；closeTab 已修改→确认后删除；closeTab 最后一个→自动新建；updateContent 更新 isModified；activateTab 切换内容；newUntitledTab 创建空标签；markTabSaved 清除 isModified |
| editor-store | `src/stores/editor-store.ts` | 9 | ✅ 通过 | setContent 更新内容；toggleMode 切换 split/wysiwyg；toggleFocusMode 翻转；setIsLargeFile 标记；所有 setter 正确更新状态 |
| app-store | `src/stores/app-store.ts` | 8 | ✅ 通过 | openFile 设置文件信息；markSaved 更新快照；newFile 重置状态；checkModification 检测变更；setVersion |
| sidebar-store | `src/stores/sidebar-store.ts` | 10 | ✅ 通过 | setActiveTab 切换；toggleExpand 展开/折叠；refreshFileTree 保持展开状态；getSavedWidth/saveWidth 持久化 |

**tab-store 核心测试示例**：

```typescript
// test/unit/stores/tab-store.test.ts
import { useTabStore } from '../../../src/stores/tab-store'

beforeEach(() => useTabStore.setState({ tabs: [], activeTabId: null, _nextId: 0 }))

test('openFile 新文件创建标签并激活', () => {
  useTabStore.getState().openFile('/a/b.md', '# hello')
  const s = useTabStore.getState()
  expect(s.tabs).toHaveLength(1)
  expect(s.tabs[0].filePath).toBe('/a/b.md')
  expect(s.tabs[0].fileName).toBe('b.md')
  expect(s.activeTabId).toBe(s.tabs[0].id)
})

test('openFile 已存在则只切换', () => {
  useTabStore.getState().openFile('/a.md', 'a')
  useTabStore.getState().openFile('/b.md', 'b')
  useTabStore.getState().openFile('/a.md', 'a') // 再次打开 a
  expect(useTabStore.getState().tabs).toHaveLength(2)
  expect(useTabStore.getState().tabs[0].filePath).toBe('/a.md')
})

test('closeTab 最后一个标签时自动新建', async () => {
  useTabStore.getState().openFile('/a.md', 'x')
  await useTabStore.getState().closeTab('tab-1')
  expect(useTabStore.getState().tabs).toHaveLength(1)
  expect(useTabStore.getState().tabs[0].filePath).toBeNull()
})

test('updateContent 修改后 isModified 为 true', () => {
  useTabStore.getState().openFile('/a.md', 'original')
  const id = useTabStore.getState().activeTabId!
  useTabStore.getState().updateContent(id, 'modified')
  expect(useTabStore.getState().tabs[0].isModified).toBe(true)
})
```

#### 3.1.2 编辑器核心（优先级 P0）

| 测试 | 模块 | 用例数 | 状态 | 核心用例 |
|------|------|--------|------|---------|
| format-helpers | `src/editor/format-helpers.ts` | 23 | ✅ 通过 | toggleBold 加粗/去除；toggleItalic 斜体/去除；insertHeading H1/H2/H3；toggleBlockquote 添加/去除；insertCodeBlock 选中/无选中；insertLink 选区正确；insertImage 插入格式正确；insertHorizontalRule；insertMathBlock；insertUnorderedList；insertOrderedList；insertStrikethrough；insertInlineCode；toggle 行为 |

```typescript
// test/unit/editor/format-helpers.test.ts
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import * as fmt from '../../../src/editor/format-helpers'

function createView(doc: string): EditorView {
  return new EditorView({ state: EditorState.create({ doc }) })
}

test('toggleBold 包裹选中文本', () => {
  const view = createView('hello world')
  view.dispatch({ selection: { anchor: 0, head: 5 } }) // 选中 hello
  fmt.toggleBold(view)
  expect(view.state.doc.toString()).toBe('**hello** world')
})

test('toggleBold 去除已有加粗', () => {
  const view = createView('**hello** world')
  view.dispatch({ selection: { anchor: 0, head: 12 } })
  fmt.toggleBold(view)
  expect(view.state.doc.toString()).toBe('hello world')
})
```

#### 3.1.3 工具函数（优先级 P1）

| 测试 | 模块 | 用例数 | 状态 | 核心用例 |
|------|------|--------|------|---------|
| sanitize | `src/utils/sanitize.ts` | 6 | ✅ 通过 | 过滤 `<script>` 标签；保留安全标签 h1/p/a等；保留 SVG 标签；过滤 data 属性；白名单 attr 保留；XSS payload 全部过滤 |
| dom-diff | `src/utils/dom-diff.ts` | 3 | ✅ 通过 | 增量更新文本；跳过 .mermaid-rendered 元素；跳过 .katex 元素 |
| path | `src/utils/path.ts` | 4 | ✅ 通过 | 正斜杠提取文件名；反斜杠提取文件名；无分隔符时返回原值 |
| large-file-handler | `src/editor/large-file-handler.ts` | 3 | ✅ 通过 | 小于 1MB 返回 false；等于 1MB 返回 true；大于 1MB 返回 true |

```typescript
// test/unit/utils/sanitize.test.ts
import { sanitizeHtml } from '../../../src/utils/sanitize'

test('过滤 script 标签', () => {
  const result = sanitizeHtml('<script>alert(1)</script><p>safe</p>')
  expect(result).not.toContain('script')
  expect(result).toContain('safe')
})

test('保留安全标签', () => {
  const result = sanitizeHtml('<h1>Title</h1><a href="x">link</a>')
  expect(result).toContain('<h1>')
  expect(result).toContain('<a')
})

test('过滤 data 属性', () => {
  const result = sanitizeHtml('<span data-xss="evil">text</span>')
  expect(result).not.toContain('data-xss')
})
```

#### 3.1.4 服务层（优先级 P1）

| 测试 | 模块 | 用例数 | 状态 | 核心用例 |
|------|------|--------|------|---------|
| theme-service | `src/services/theme-service.ts` | 5 | ✅ 通过 | 默认 light；switchTheme(dark/sepia)；toggleTheme 循环；localStorage 持久化 |
| encoding-detector | `electron/services/encoding-detector.ts` | 6 | ✅ 通过 | UTF-8 BOM；UTF-16LE BOM；UTF-16BE BOM；GBK 解码；ASCII → UTF-8；空 buffer |

---

### 3.2 集成测试

#### 3.2.1 组件集成（优先级 P0）

| 测试 | 组件 | 用例数 | 状态 | 核心用例 |
|------|------|--------|------|---------|
| TabBar | `src/components/Editor/TabBar.tsx` | 5 | ✅ 通过 | 多标签渲染；点击切换激活态；✕ 按钮关闭；+ 按钮新建；修改标记显示 |
| FormatToolbar | `src/components/Editor/FormatToolbar.tsx` | 5 | ✅ 通过 | 全部按钮渲染；点击 H1 插入标题；点击 B 加粗；tooltip 显示；无 view 时不报错 |
| ThemeSelector | `src/components/Settings/ThemeSelector.tsx` | 3 | ✅ 通过 | 三主题渲染；点击切换 active 态；data-theme 联动 |
| PreviewPane | `src/components/Preview/PreviewPane.tsx` | 3 | ✅ 通过 | Markdown 渲染为 HTML；KaTeX 公式渲染；XSS 被过滤 |
| FileTreePanel | `src/components/Sidebar/FileTreePanel.tsx` | 3 | ✅ 通过 | 文件夹名渲染；文件节点渲染；目录节点渲染 |
| SearchPanel | `src/components/Sidebar/SearchPanel.tsx` | 3 | ✅ 通过 | 搜索输入框渲染；大小写选项；搜索状态显示 |

```typescript
// test/integration/components/TabBar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import TabBar from '../../../src/components/Editor/TabBar'
import { useTabStore } from '../../../src/stores/tab-store'

beforeEach(() => {
  useTabStore.setState({ tabs: [], activeTabId: null })
  useTabStore.getState().openFile('/a.md', '# A')
  useTabStore.getState().openFile('/b.md', '# B')
})

test('渲染两个标签', () => {
  render(<TabBar />)
  expect(screen.getByText('a.md')).toBeInTheDocument()
  expect(screen.getByText('b.md')).toBeInTheDocument()
})

test('点击标签激活', () => {
  render(<TabBar />)
  fireEvent.click(screen.getByText('a.md'))
  expect(useTabStore.getState().activeTabId).toBeTruthy()
})
```

#### 3.2.2 流程集成（优先级 P1）

| 测试 | 流程 | 用例数 | 状态 | 核心用例 |
|------|------|--------|------|---------|
| 打开文件 | file-open-flow | 4 | ✅ 通过 | 文件树打开→标签新建；文件树打开→标签切换；搜索结果打开→标签新建；搜索结果打开→切换已有标签 |
| 标签切换 | tab-switch-flow | 3 | ✅ 通过 | 切换时 editorStore 内容正确更新；切回后内容保持；每个标签独立 isModified |
| 主题切换 | theme-switch-flow | 3 | ✅ 通过 | 亮→暗→护眼→亮三次切换；toggleTheme 循环；localStorage 持久化恢复 |

---

### 3.3 E2E 测试

| 测试 | 文件 | 用例数 | 核心场景 |
|------|------|--------|---------|
| 编辑器 | `e2e/editor.spec.ts` | 5 | 输入文本→预览渲染；加粗快捷键→文本包裹；打开文件→编辑器显示内容；切换 WYSIWYG 模式→标记隐藏；专注模式开启→非活动行置灰 |
| 文件操作 | `e2e/file-operations.spec.ts` | 4 | 新建文件→标签出现；保存→文件写入成功；另存为→新文件创建；关闭标签→文件释放 |
| 侧边栏 | `e2e/sidebar.spec.ts` | 3 | 打开文件夹→文件树显示；点击文件→标签新建；全局搜索→结果列表 |
| 导出 | `e2e/export.spec.ts` | 2 | 导出 HTML→文件存在且含内容；导出 PDF→文件存在 |

---

## 4. 测试优先级与阶段计划

### 4.1 实施路线图

```
第 1 周 ──────────────────────────────────────────────   ✅ 已完成
  Phase-1：环境搭建 + Store 层测试（P0）
  ├── vitest.config.ts / test/setup.ts
  ├── tab-store.test.ts (12 cases)     → ✅ 通过
  ├── editor-store.test.ts (9 cases)   → ✅ 通过
  ├── app-store.test.ts (8 cases)      → ✅ 通过
  └── sidebar-store.test.ts (10 cases) → ✅ 通过
  → 实际完成：39 用例，Store 层 100% 通过

第 2 周 ──────────────────────────────────────────────   ✅ 已完成
  Phase-2：编辑器核心 + 工具函数测试（P0+P1）
  ├── format-helpers.test.ts (13→23 cases)   → ✅ 通过
  ├── sanitize.test.ts (6 cases)             → ✅ 通过
  ├── path.test.ts (3→4 cases)               → ✅ 通过
  ├── large-file-handler.test.ts (3 cases)  → ✅ 通过
  └── dom-diff.test.ts (3 cases)            → ✅ 通过
  → 实际完成：39 用例，工具层 100% 通过

第 3 周 ──────────────────────────────────────────────   ✅ 已完成
  Phase-3：组件集成测试（P0）
  ├── TabBar.test.tsx (5 cases)        → ✅ 通过
  ├── FormatToolbar.test.tsx (5 cases) → ✅ 通过
  ├── ThemeSelector.test.tsx (3 cases) → ✅ 通过
  ├── PreviewPane.test.tsx (3 cases)   → ✅ 通过
  ├── FileTreePanel.test.tsx (3 cases) → ✅ 通过
  └── SearchPanel.test.tsx (3 cases)   → ✅ 通过
  → 实际完成：22 用例，组件层 100% 通过

第 4 周 ──────────────────────────────────────────────   ✅ 已完成
  Phase-4：服务层 + 流程集成（P1）
  ├── theme-service.test.ts (5 cases)        → ✅ 通过
  ├── encoding-detector.test.ts (6 cases)    → ✅ 通过
  ├── file-open-flow.test.ts (4 cases)       → ✅ 通过
  ├── tab-switch-flow.test.ts (3 cases)      → ✅ 通过
  └── theme-switch-flow.test.ts (3 cases)    → ✅ 通过
  → 实际完成：21 用例，服务层 + 流程 100% 通过

第 5 周 ──────────────────────────────────────────────   📋 待实施
  Phase-5：E2E 测试 + 覆盖率调优
  ├── e2e/editor.spec.ts (5 cases)
  ├── e2e/file-operations.spec.ts (4 cases)
  ├── e2e/sidebar.spec.ts (3 cases)
  └── e2e/export.spec.ts (2 cases)
  → 覆盖目标：14 用例，总体 70%+
  → CI/CD 集成

第 6 周 ──────────────────────────────────────────────   📋 待实施
  Phase-6：边界测试 + 稳定性验证
  ├── 大文件（>1MB）编辑器响应
  ├── 大量标签（>30）切换性能
  ├── 特殊编码文件（GBK/Shift-JIS）
  ├── 路径含特殊字符
  ├── 跨平台兼容（Windows/macOS/Linux）
  ├── 长时间运行内存泄漏
  └── 网络离线 hljs 降级
  → 覆盖目标：边界场景 80%+
```

### 4.2 覆盖目标

| 层 | 模块 | 当前 | 目标覆盖率 | 测试类型 |
|----|------|------|-----------|---------|
| Store | tab-store / editor-store / app-store / sidebar-store | **39 ✅** | ≥ 90% | 单元 |
| 工具 | sanitize / path / format-helpers / dom-diff / large-file | **39 ✅** | ≥ 85% | 单元 |
| 服务 | theme-service / encoding-detector | **11 ✅** | ≥ 80% | 单元 |
| 组件 | TabBar / FormatToolbar / PreviewPane / ThemeSelector / FileTree / Search | **22 ✅** | ≥ 75% | 集成 |
| 流程 | 打开文件 / 切换标签 / 主题切换 | **10 ✅** | ≥ 70% | 集成 |
| E2E | 编辑器 / 文件操作 / 侧边栏 / 导出 | **0 📋** | ≥ 10 场景 | E2E |
| **总体** | **核心模块** | **121 ✅** | **≥ 70%** | **全部** |

---

## 5. 关键模块测试优先级

```
P0（第 1-2 周，必须优先覆盖）
├── tab-store （新增模块，风险最高）
├── format-helpers （快捷键和工具栏共用，用户频繁操作）
├── sanitize （安全相关，XSS 防护）
├── TabBar （新增组件，核心交互）
└── FormatToolbar （高频交互组件）

P1（第 3-4 周）
├── editor-store / app-store / sidebar-store（稳定模块，回归保护）
├── PreviewPane（预览核心，容易受渲染管线影响）
├── theme-service（多主题切换逻辑）
├── encoding-detector（文件编码影响数据完整性）
├── 流程集成测试（多组件串联场景）

P2（第 5-6 周）
├── E2E 测试（完整用户旅程）
├── dom-diff / morphdom 集成
├── 大文件和边界场景
├── 跨平台兼容性
└── 性能基准
```

---

## 6. 执行策略

### 6.1 测试命令

```bash
# 运行全部单元 + 集成测试
npm run test

# 监视模式（开发时持续运行）
npm run test:watch

# 生成覆盖率报告（HTML 在 coverage/ 目录）
npm run test:coverage

# 仅运行特定测试文件
npx vitest run test/unit/stores/tab-store.test.ts

# E2E
npm run test:e2e

# CI 模式（设置 --reporter junit 输出 XML）
npx vitest run --reporter junit --outputFile test-results.xml
```

### 6.2 CI 集成

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx vitest run --coverage
      - uses: actions/upload-artifact@v4
        with: { name: coverage, path: coverage/ }
```

### 6.3 质量门禁

| 检查项 | 通过条件 | 阻断 |
|--------|---------|------|
| 类型检查 | `tsc --noEmit` 零错误 | 是 |
| Lint | `eslint` 零 error | 是 |
| 单元测试 | 全部通过 | 是 |
| 覆盖率 | ≥ 70% | 否（但 PR reviewer 需确认） |
| E2E | 核心场景通过 | 是（master 合并前） |

### 6.4 手动测试清单

```markdown
□ 新建文件 → 输入内容 → Ctrl+S → 关闭 → 重开 → 内容保留
□ 打开已有 .md 文件 → 编辑 → Ctrl+S → 文件已更新
□ 文件树打开文件 → 标签出现 → 切换标签 → 内容独立
□ 关闭标签 → 未保存 → 弹出确认 → 点取消 → 标签保留
□ Ctrl+B → **文本** → 预览区粗体显示
□ Ctrl+Shift+P → WYSIWYG 模式 → # 标记隐藏 → 光标移入显示
□ F11 → 专注模式 → 非活动行半透明
□ 切换暗色主题 → 全局 UI 和预览区变暗
□ 导出 HTML → 浏览器打开 → 样式完整
□ 拖入 .md 文件 → 自动打开
□ GBK 编码文件 → 内容正常显示（非乱码）
□ >1MB 大文件 → 提示降级
```

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| CM6 在 jsdom 中无法渲染 | 编辑器组件测试复杂 | EditorPane 的 CM6 部分 mock，测试外层逻辑（TabBar/FormatToolbar）与 store 的交互 |
| Electron API 在测试中不可用 | 组件依赖 IPC 报错 | setup.ts 中全量 mock `window.electronAPI` |
| jsdom 不支持 Canvas/SVG | Mermaid/KaTeX 相关测试失败 | 这些模块跳过单元测试，只覆盖 E2E |
| vitest-electron-plugin 兼容性 | 主进程测试困难 | 主进程逻辑（encoding-detector 等）用 Node 环境单独测试 |
| 测试运行时间过长 | 开发效率下降 | 单元+集成控制在 30 秒内，E2E 单独 CI job |
