# 未来发展规划

**版本**：v1.1  
**日期**：2026-05-04  
**现状**：Phase 1-6 核心功能完成，121 测试通过

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
| 121 单元+集成测试 | ✅ 稳定 |
| DOMPurify XSS + 路径遍历防护 + Mermaid strict | ✅ 稳定 |

### 当前局限

- 无图片管理（仅支持 Markdown 图片链接）
- 无插件系统（`PluginManager` 简化版已实现，完整引擎部分）
- 无云同步 / 协作 / Web 版本
- 无 E2E 测试 / CI/CD
- 无拼写检查 / 代码块运行器

---

## 2. 功能路线图（概述）

### Phase 7 — 图片与资产管理（2-3 周）

- 截图 Ctrl+V 粘贴 → 自动保存到 `assets/` 目录并插入 `![](...)`
- 拖入图片文件支持
- 图片管理器面板（缩略图预览、跳转、删除、批量导出）
- 可选：`sharp` 图片压缩

### Phase 8 — 插件系统完善（3-4 周）

- PluginEngine 完整解耦（HostAPIBridge 接口）
- 目录扫描自动发现（`plugins/builtins/` + `~/.confucius/plugins/`）
- 依赖管理（拓扑排序、循环检测）
- 事件总线（插件间通信）
- 配置持久化（`localStorage`）
- 内置插件：emoji、toc、footnote、word-count

### Phase 9 — Git 同步（2-3 周）

- 保存后自动 `git commit`（3 秒防抖）
- 手动 `git pull` / `git push`（菜单项）
- 冲突检测与提示
- 依赖：`simple-git` 或 `isomorphic-git`

### Phase 10 — 编辑体验进阶（2-3 周）

- 标题折叠/展开（CM6 `foldGutter`）
- 可拖拽重组文档结构（标题区块拖拽）
- 内联代码运行器（JS eval 沙箱）
- 拼写检查（`nspell` / `hunspell`）

### Phase 11 — Web 版本（5-6 周）

- `StorageAdapter` 抽象（Electron ↔ REST API 切换）
- Node.js 后端（Fastify/Express）
- 共享 80%+ 代码（`components/`、`editor/`、`stores/`）
- PWA 支持

### Phase 12 — 协作编辑（6-8 周）

- Yjs（CRDT）+ `y-codemirror.next` 集成
- 实时光标 + 选区显示
- 离线编辑 → 重连合并
- WebSocket 服务器（`y-websocket`）

### Phase 13 — 国际化与无障碍（1-2 周）

- `react-i18next` 中/英文切换
- ARIA 属性 + 键盘导航 + 高对比度主题

---

## 3. 技术栈演进

### 短期（0-6 个月）

| 当前 | 目标 |
|------|------|
| Electron 28 | Electron 33+ |
| React 18 | React 19 |
| 无 CI/CD | GitHub Actions |
| 无 E2E | Playwright + Electron |

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

## 4. 技术债务清理

| 项 | 优先级 |
|----|--------|
| 创建 `services/` 层封装 IPC 调用（`electron-bridge.ts` 已完成） | P1 |
| CSS Modules 迁移（降低全局命名冲突） | P2 |
| hljs 主题本地打包（移除 CDN 依赖） | P1 |
| E2E 测试（Playwright + Electron，14+ spec） | P0 |
| WYSIWYG 插件斜体正则兼容性修复 | P2 |
