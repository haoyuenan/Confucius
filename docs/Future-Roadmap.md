# 未来发展规划

**版本**：v0.3.0  
**日期**：2026-05-19  
**现状**：Phase 1-6 核心功能 + 插件引擎 v3 + 命令面板 + 工作区恢复 + 中英双语 i18n 完成，141 测试全部通过

---

## 1. 现状

### 已完成能力

| 领域 | 成熟度 |
|------|--------|
| CM6 Markdown 编辑 + 语法高亮 + 格式化工具栏 + 快捷键 | ✅ 稳定 |
| markdown-it + highlight.js + KaTeX + Mermaid + DOMPurify | ✅ 稳定 |
| 双栏 / WYSIWYG / 纯预览三种模式 + 专注/打字机模式 | ✅ 稳定 |
| 多标签页 + 文件树 + 全局搜索 + 编码自动检测 | ✅ 稳定 |
| HTML / PDF 导出 | ✅ 稳定 |
| 亮色/暗色/护眼三主题 + 持久化 | ✅ 稳定 |
| 117 单元+集成测试 | ✅ 稳定 |
| 14 E2E 测试（Playwright + Electron） | ✅ 稳定 |
| GitHub Actions CI/CD（lint/test/e2e/release） | ✅ 稳定 |
| DOMPurify XSS + 路径遍历防护 + Mermaid strict | ✅ 稳定 |
| 插件引擎完整版（解耦/发现/依赖/事件/持久化/沙箱/管理 UI） | ✅ 稳定 |
| 状态栏（字数/光标/编码/模式）+ 外部插件注册 | ✅ 稳定 |
| 纯预览模式 + 编辑/预览滚动同步 | ✅ 稳定 |
| 命令面板 Ctrl+E（模糊搜索 + 最近使用 + 插件命令集成） | ✅ 稳定 |
| 工作区会话恢复（标签/侧边栏/主题自动保存恢复） | ✅ 稳定 |
| 中英双语 i18n（实时切换 + Electron 菜单翻译） | ✅ 稳定 |
| CSS Modules 迁移 + 技术债务清理（22/22 项） | ✅ 完成 |

### 当前局限

- 无云同步 / 协作 / Web 版本
- 无拼写检查

---

## 2. 功能路线图（概述）

### Phase 7 — 图片与资产管理（2-3 周）

- 截图 Ctrl+V 粘贴 → 自动保存到 `assets/` 目录并插入 `![](...)`
- 拖入图片文件支持
- 图片管理器面板（缩略图预览、跳转、删除、批量导出）
- 可选：`sharp` 图片压缩

### Phase 8 — Git 同步（2-3 周）

- 保存后自动 `git commit`（3 秒防抖）
- 手动 `git pull` / `git push`（菜单项）
- 冲突检测与提示
- 依赖：`simple-git` 或 `isomorphic-git`

### Phase 9 — 编辑体验进阶（2-3 周）

- 标题折叠/展开（CM6 `foldGutter`）
- 可拖拽重组文档结构（标题区块拖拽）
- 内联代码运行器（JS eval 沙箱）
- 拼写检查（`nspell` / `hunspell`）

### Phase 10 — Web 版本（5-6 周）

- `StorageAdapter` 抽象（Electron ↔ REST API 切换）
- Node.js 后端（Fastify/Express）
- 共享 80%+ 代码（`components/`、`editor/`、`stores/`）
- PWA 支持

### Phase 11 — 协作编辑（6-8 周）

- Yjs（CRDT）+ `y-codemirror.next` 集成
- 实时光标 + 选区显示
- 离线编辑 → 重连合并
- WebSocket 服务器（`y-websocket`）

### Phase 12 — 无障碍（1-2 周）

- ARIA 属性 + 键盘导航 + 高对比度主题

> **注**：国际化（i18n）中文/英文切换已在 v0.3.0 完成。

---

## 3. 技术栈演进

### 短期（0-6 个月）

| 当前 | 目标 |
|------|------|
| Electron 28 | Electron 33+ |
| React 18 | React 19 |

### 中期（6-12 个月）

- 云同步：Supabase 或自研 WebSocket 服务
- Web 版：`StorageAdapter` 抽象层
- 状态管理：现有 Zustand 保持

### 长期（12-24 个月）

- 协作编辑：Yjs
- 移动端：Tauri Mobile
- AI 辅助：OpenAI API / 本地 LLM
- 桌面分发：Electron → Tauri（可选，更小体积）

---

## 4. 技术债务

| 项 | 优先级 | 状态 |
|----|--------|------|
| E2E 测试（Playwright + Electron，14 spec） | P0 | ✅ 已完成 |
| CI/CD（GitHub Actions：ci/e2e/release） | P1 | ✅ 已完成 |
| CSS Modules 迁移（4 个组件已迁移） | P2 | ✅ 已完成 |
| hljs 主题本地打包（移除 CDN 依赖） | P1 | ✅ 已完成 |
| 创建 FileService 类（10 个方法） | P1 | ✅ 已完成 |
| markdown-it-texmath 集成（替换自研 DOM 遍历） | P2 | ✅ 已完成 |
| 搜索并行化（8 并发度 Promise.all） | P2 | ✅ 已完成 |
| 删除死代码 plugin-manager.ts | P1 | ✅ 已完成 |
| app-store 文件状态精简（移除 9 个冗余字段） | P2 | ✅ 已完成 |
| IPC sanitizePath 简化（FileService 吸收） | P2 | ✅ 已完成 |
| 大文件限制落实（PreviewPane 跳过 Mermaid） | P2 | ✅ 已完成 |
