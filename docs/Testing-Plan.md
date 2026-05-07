# 测试方案

**版本**：v1.3  
**当前状态**：✅ 117 单元/集成 + 14 E2E 测试全部通过

---

## 1. 测试策略

```
测试金字塔
         ┌──────────┐
         │  E2E     │  ← Playwright + Electron（待实施）
         │   (10%)  │
        ┌┼──────────┼┐
        │ 集成测试   │  ← React Testing Library + Vitest
        │   (30%)    │
       ┌┼────────────┼┐
       │  单元测试    │  ← Vitest
       │    (60%)     │
       └──────────────┘
```

| 用途 | 工具 |
|------|------|
| 测试运行器 | Vitest（与 Vite 共享配置） |
| React 组件测试 | @testing-library/react + user-event |
| IPC Mock | `test/setup.ts` 全量 mock `window.electronAPI` |
| 覆盖率 | @vitest/coverage-v8（阈值 70%） |
| E2E | Playwright + Electron（14 场景） |

---

## 2. 测试目录结构

```
test/
├── setup.ts                       # 全局 setup（jsdom + mock electronAPI）
├── unit/
│   ├── stores/                    # ✅ 34 cases
│   │   ├── tab-store.test.ts
│   │   ├── editor-store.test.ts
│   │   ├── app-store.test.ts        (3 cases, 移除冗余文件状态后精简)
│   │   └── sidebar-store.test.ts
│   ├── editor/                    # ✅ 23 cases
│   │   └── format-helpers.test.ts
│   ├── utils/                     # ✅ 16 cases
│   │   ├── sanitize.test.ts
│   │   ├── dom-diff.test.ts
│   │   ├── path.test.ts
│   │   └── large-file-handler.test.ts
│   └── services/                  # ✅ 11 cases
│       ├── theme-service.test.ts
│       └── encoding-detector.test.ts
├── integration/
│   ├── components/                # ✅ 22 cases
│   │   ├── TabBar.test.tsx
│   │   ├── FormatToolbar.test.tsx
│   │   ├── ThemeSelector.test.tsx
│   │   ├── PreviewPane.test.tsx
│   │   ├── FileTreePanel.test.tsx
│   │   └── SearchPanel.test.tsx
│   └── flows/                     # ✅ 10 cases
│       ├── file-open-flow.test.ts
│       ├── tab-switch-flow.test.ts
│       └── theme-switch-flow.test.ts
└── e2e/                           # ✅ 14 cases
    ├── helpers.ts                  # Playwright fixture + 辅助函数
    ├── editor.spec.ts              # ✅ 5 cases（输入/加粗/WYSIWYG/预览/专注模式）
    ├── file-operations.spec.ts     # ✅ 4 cases（新建/修改指示器/关闭/菜单动作）
    ├── sidebar.spec.ts             # ✅ 3 cases（标签切换/折叠/搜索）
    └── export.spec.ts              # ✅ 2 cases（预览 HTML/导出函数）
```

---

## 3. 当前覆盖

| 层 | 模块 | 用例数 | 状态 |
|----|------|--------|------|
| Store | tab/editor/app/sidebar | 34 | ✅ |
| 工具 | sanitize/path/dom-diff/large-file | 39 | ✅ |
| 服务 | theme-service/encoding-detector | 11 | ✅ |
| 组件 | TabBar/FormatToolbar/PreviewPane/ThemeSelector/FileTree/Search | 22 | ✅ |
| 流程 | 打开文件/切换标签/主题切换 | 10 | ✅ |
| E2E | 编辑器/文件操作/侧边栏/导出 | 14 | ✅ |
| **总计** | | **131** | ✅ |

---

## 4. npm 脚本

```bash
npm run test           # 运行单元+集成测试
npm run test:watch     # 监视模式
npm run test:coverage  # 覆盖率报告
npm run test:e2e       # 运行 E2E 测试（需先 npm run build）
npm run test:e2e:headed # 有头模式运行 E2E
```

---

## 5. E2E 测试（已完成）

| 文件 | 场景数 | 状态 |
|------|--------|------|
| `e2e/editor.spec.ts` | 5（输入/加粗/WYSIWYG/预览/专注模式） | ✅ |
| `e2e/file-operations.spec.ts` | 4（新建/修改指示器/关闭/菜单动作） | ✅ |
| `e2e/sidebar.spec.ts` | 3（标签切换/折叠/搜索） | ✅ |
| `e2e/export.spec.ts` | 2（预览 HTML/导出函数） | ✅ |
