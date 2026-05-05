# 测试方案

**版本**：v1.2  
**当前状态**：✅ 117 测试全部通过（20 文件）

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
| E2E（规划） | Playwright + Electron |

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
└── e2e/                           # 📋 规划中
    ├── editor.spec.ts
    ├── file-operations.spec.ts
    ├── sidebar.spec.ts
    └── export.spec.ts
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
| **总计** | | **117** | ✅ |

---

## 4. npm 脚本

```bash
npm run test           # 运行全部
npm run test:watch     # 监视模式
npm run test:coverage  # 覆盖率报告
```

---

## 5. 待实施（E2E）

| 文件 | 场景数 |
|------|--------|
| `e2e/editor.spec.ts` | 5（输入/加粗/打开文件/WYSIWYG/专注模式） |
| `e2e/file-operations.spec.ts` | 4（新建/保存/另存为/关闭） |
| `e2e/sidebar.spec.ts` | 3（文件树/搜索/大纲跳转） |
| `e2e/export.spec.ts` | 2（HTML/PDF） |
