# Confucius 项目全面代码审查报告

**审查日期**：2026-05-03  
**审查范围**：`electron/` + `src/` 全部源码，对照 `docs/` 下所有设计文档  
**审查版本**：基于 commit `1b08664`

---

## 一、Bug 与功能缺陷（3 项待处理）

| # | 级别 | 文件 | 问题 | 设计依据 |
|---|------|------|------|---------|
| 1 | P1 | ~~`src/editor/wysiwyg-plugin.ts`~~ | WYSIWYG 全量文档正则扫描，长文档高频输入时影响响应性能 | ✅ 已修复：>50000 字符时仅扫描可见视口 ±1000 字符 |
| 2 | P1 | ~~`src/components/Editor/EditorLayout.tsx`~~ | 模式切换时未使用 key 强制重建 CM6 实例 | ✅ 已修复：`key="cm6-wysiwyg"` / `key="cm6-split"` |
| 3 | P2 | `src/components/Sidebar/OutlinePanel.tsx` | 大纲更新无防抖，高频输入时频繁触发 `extractOutline`，浪费计算资源 | Phase05-2 §3.2 |

---

## 二、实现与设计不符（5 项待重构）

| # | 设计文档 | 设计要求 | 实际实现 | 影响 |
|---|---------|---------|---------|------|
| 1 | Phase01 §2 | `services/` 层封装所有 IPC 通信 | 组件直接调 `window.electronAPI`（共 21 处调用） | 违反分层架构，渲染进程业务逻辑与 IPC 耦合 |
| 2 | Phase01 §2 | CSS Modules + CSS Variables 作用域隔离 | 纯全局 CSS（`global.css` 等 6 个文件） | 无作用域隔离，样式命名冲突风险 |
| 3 | Phase02 §4.1 | `FileService` 类封装文件操作 | `ipc-handlers.ts` 中独立函数，无类封装 | 缺少 OOP 抽象，难以扩展缓存/状态管理 |
| 4 | Phase03 §2.3 | 使用 `markdown-it-texmath` 处理公式 | `PreviewPane.tsx` 自定义 DOM 遍历渲染 KaTeX | 未利用已安装插件，实现复杂且效率低 |
| 5 | Phase05-1 §7.1 | EditorPane 用 `key={mode}` 重建 CM6 | `EditorLayout.tsx` 无 key 属性传递 | 条件渲染虽会重新挂载，但不够可靠，可能导致状态残留 |

---

## 三、性能问题（3 项待优化）

| # | 文件 | 描述 | 建议 |
|---|------|------|------|
| 1 | `electron/services/search-service.ts` | 串行逐文件搜索（`for...of` 循环），大量文件时响应慢 | 使用 `Promise.all` 并行读取，限制并发数 |
| 2 | `src/components/Preview/PreviewPane.tsx` | 每次内容变化全量 `innerHTML` 替换 + Mermaid + KaTeX 重渲染 | 引入 `morphdom` 增量 DOM 更新，跳过已渲染元素 |
| 3 | `src/editor/outline-parser.ts` | 每次调用遍历全部行计算偏移，大纲更新频繁时浪费 CPU | 添加 200ms 防抖，或增量解析仅处理变更行 |

---

## 四、安全问题（2 项待处理）

| # | 文件 | 描述 | 设计依据 | 建议 |
|---|------|------|---------|------|
| 1 | `src/editor/markdown-renderer.ts:6` | `html: true` 允许任意 HTML 注入，存在 XSS 风险 | Phase05-2 §3.3 | 集成 DOMPurify 过滤，白名单允许安全标签 |
| 2 | `src/editor/mermaid-renderer.ts:13` | `securityLevel: 'loose'` 允许 Mermaid 图表中的点击事件 | Mermaid 官方建议 | 生产环境改用 `'strict'` 或 `'sandbox'` |

---

## 五、代码质量问题（4 项待改进）

| # | 文件 | 问题 | 建议 |
|---|------|------|------|
| 1 | `electron/services/file-watcher.ts:21-28` | 轮询降级方案每 2 秒无条件触发刷新，不检测实际变更 | 改为记录上次 mtime 或文件列表，有变更才触发 |
| 2 | `src/services/theme-service.ts:51-58` | highlight.js 主题依赖外部 CDN，网络失败时降级不完善 | 本地备份关键主题 CSS，CDN 失败时切换本地 |
| 3 | `src/components/Preview/PreviewPane.tsx:68` | KaTeX 行内公式正则使用复杂 lookahead/lookbehind `(?<!\$)\$([^$\n]+?)\$(?!\$)` | 考虑简化或使用 markdown-it-texmath 插件 |
| 4 | `src/editor/wysiwyg-plugin.ts:64` | 斜体正则 `(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)` 在旧浏览器/JS引擎可能有兼容问题 | 测试兼容性或改用更简单的匹配策略 |

---

## 六、架构改进建议（非强制）

| # | 当前状态 | 设计目标 | 改进路径 |
|---|---------|---------|---------|
| 1 | `src/` 下无 `services/` 层文件 | Phase01 规定 `services/` 封装 IPC | 创建 `src/services/file-service.ts`、`search-service.ts` 等，封装 `window.electronAPI` 调用 |
| 2 | 全局 CSS 文件 | Phase01 规定 CSS Modules | 逐步迁移组件样式为 `.module.css`，保留全局变量 |
| 3 | `ipc-handlers.ts` 单文件 313 行 | Phase02 规定模块化 IPC | 拆分为 `file-ipc.ts`、`sidebar-ipc.ts`、`search-ipc.ts` 等 |

---

## 七、已正确实现的核心功能

| 功能 | 实现文件 | 验收状态 |
|------|---------|---------|
| 编辑器核心 (CM6) | `src/editor/cm6-setup.ts` | ✅ 符合 Phase02 设计 |
| Markdown 渲染 | `src/editor/markdown-renderer.ts` | ✅ 基础功能完整，待 XSS 防护 |
| 文件读写 | `electron/ipc-handlers.ts` | ✅ 含路径安全校验 |
| 文件树侧边栏 | `src/components/Sidebar/FileTreePanel.tsx` | ✅ 符合 Phase03 设计 |
| 全局搜索 | `electron/services/search-service.ts` | ✅ 功能完整，待性能优化 |
| 大纲面板 | `src/components/Sidebar/OutlinePanel.tsx` | ✅ 功能完整，待防抖 |
| 主题切换 | `src/services/theme-service.ts` | ✅ 三主题切换正常 |
| 导出 HTML/PDF | `electron/services/export-service.ts` | ✅ 含页面就绪等待机制 |
| WYSIWYG 模式 | `src/editor/wysiwyg-plugin.ts` | ✅ 核心功能完整，待性能优化 |
| 格式化工具栏 | `src/components/Editor/FormatToolbar.tsx` | ✅ 快捷键与按钮共用逻辑 |
| 文件监听 | `electron/services/file-watcher.ts` | ✅ 含防抖，降级方案待改进 |

---

## 八、汇总统计

| 类别 | 待处理 | 已修复 |
|------|--------|--------|
| Bug | 1 | 2 |
| 设计不符 | 5 | - |
| 性能问题 | 3 | - |
| 安全问题 | 1 | 1 |
| 代码质量 | 4 | - |
| 核心功能 | - | 11 |
| **合计** | **14** | **14** |

---

## 九、优先级建议

### P0（应立即处理）
- **安全问题 #1**：XSS 防护 — 集成 DOMPurify（Phase05-2 已规划）

### P1（建议本周处理）
- ~~**Bug #1**：WYSIWYG 性能优化~~ ✅ 已修复
- ~~**Bug #2**：模式切换 key 属性~~ ✅ 已修复
- ~~**安全 #2**：Mermaid securityLevel~~ ✅ 已修复

### P2（建议本月处理）
- **设计不符 #1**：创建 `services/` 层封装 IPC
- **性能 #2**：预览区增量 DOM 更新
- **Bug #3**：大纲防抖

### P3（后续迭代）
- CSS Modules 迁移
- FileService 类封装
- IPC 模块拆分
- 搜索并行优化
- 文件监听降级改进

---

## 十、审查结论

项目整体架构符合设计文档的主要目标，核心功能（编辑器、预览、文件管理、侧边栏、导出、主题）均已正确实现。主要待处理项集中在：

1. **安全性**：XSS 防护需集成 DOMPurify（Phase05-2 已规划）
2. **性能优化**：WYSIWYG 增量解析、预览区增量渲染、搜索并行化
3. **架构合规**：services 层缺失、CSS Modules 未使用

建议按优先级逐步推进，Phase05-2 阶段应优先解决 XSS 和性能问题。