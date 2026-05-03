# Confucius 项目全面代码审查报告

**审查日期**：2026-05-03  
**审查范围**：`electron/` + `src/` 全部源码，对照 `docs/` 下所有设计文档

---

## 已修复汇总（Phase05-2）

| 类别 | 问题 | 修复方式 |
|------|------|---------|
| 专注模式 | 非活动行置灰 | `focus-mode.ts` + `.focus-mode-active .cm-line:not(.cm-active-line)` CSS |
| 打字机模式 | 编辑行视口居中 | `typewriter-mode.ts` — CM6 updateListener |
| 菜单 | F11/F12 快捷键 | `menu.ts` 视图菜单添加 checkbox 项 |
| DOM 增量 | 预览全量 innerHTML 闪烁 | `morphdom` 增量更新，跳过已渲染 Mermaid/KaTeX |
| XSS 防护 | `html: true` 允许注入 | `DOMPurify` 白名单过滤，允许 SVG 标签 |
| KaTeX 误渲染 | 代码块内 $ 被渲染 | 添加 `isInsideCode()` 检查，跳过 code/pre 节点 |
| 大文件检测 | >1MB 文件性能 | `large-file-handler.ts` 检测，强制切双栏模式 |
| macOS Cmd+W | 关闭窗口处理 | `menu.ts` 发送 `file:close` → `App.tsx` 响应 |
| PDF 代码块换行 | 导出后代码块溢出 | `export-service.ts` 添加 `white-space: pre-wrap` |
| 侧边栏宽度 | 重启后丢失 | `sidebar-store.ts` localStorage 持久化 |
| 编码检测 | GBK 文件乱码 | `encoding-detector.ts` — BOM/jschardet/iconv-lite |
| PDF 导出延迟 | 硬编码 500ms | `waitForPageReady()` 事件驱动 + 5s 兜底 |

## 待处理（10 项）

| 类别 | # | 问题 |
|------|---|------|
| 设计不符 | 1 | services 层缺失 — 组件直接调 `window.electronAPI` |
| 设计不符 | 2 | CSS Modules 未使用 — 纯全局 CSS |
| 设计不符 | 3 | FileService 类缺失 |
| 设计不符 | 4 | markdown-it-texmath 未使用 |
| 设计不符 | 5 | 模式切换 key 可改进（已基本正确） |
| 性能 | 1 | 搜索串行 — 可用 Promise.all 并行 |
| 代码质量 | 1 | 文件监听轮询降级不检测实际变更 |
| 代码质量 | 2 | hljs 主题依赖外部 CDN 降级不完善 |
| 代码质量 | 3 | KaTeX 行内公式复杂正则 |
| 代码质量 | 4 | WYSIWYG 斜体正则兼容性 |
