# Confucius 项目全面代码审查报告

**审查日期**：2026-05-03  
**审查范围**：`electron/` + `src/` 全部源码，对照 `docs/` 下所有设计文档

**当前状态**：全部已修复 ✅

---

## 已修复汇总（全部 22 项已完成）

### Phase05-2 修复项

| 类别 | 问题 | 修复方式 |
|------|------|---------|
| 专注模式 | 非活动行置灰 | `focus-mode.ts` + `.focus-mode-active .cm-line:not(.cm-active-line)` CSS |
| 打字机模式 | 编辑行视口居中 | `typewriter-mode.ts` — CM6 updateListener |
| 菜单 | F11/F12 快捷键 | `menu.ts` 视图菜单添加 checkbox 项 |
| DOM 增量 | 预览全量 innerHTML 闪烁 | `morphdom` 增量更新，跳过已渲染 Mermaid/KaTeX |
| XSS 防护 | `html: true` 允许注入 | `DOMPurify` 白名单过滤，允许 SVG 标签 |
| KaTeX 误渲染 | 代码块内 $ 被渲染 | 添加 `isInsideCode()` 检查，跳过 code/pre 节点 |
| 大文件检测 | >1MB 文件性能 | `large-file-handler.ts` 检测 → 强制切双栏 + 跳过 Mermaid |
| macOS Cmd+W | 关闭窗口处理 | `menu.ts` 发送 `file:close` → `App.tsx` 响应 |
| PDF 代码块换行 | 导出后代码块溢出 | `export-service.ts` 添加 `white-space: pre-wrap` |
| 侧边栏宽度 | 重启后丢失 | `sidebar-store.ts` localStorage 持久化 |
| 编码检测 | GBK 文件乱码 | `encoding-detector.ts` — BOM/jschardet/iconv-lite |
| PDF 导出延迟 | 硬编码 500ms | `waitForPageReady()` 事件驱动 + 5s 兜底 |

### 技术债务修复项

| # | 问题 | 修复方式 |
|---|------|---------|
| 1 | services 层缺失 — 组件直接调 `window.electronAPI` | 创建 `src/services/electron-bridge.ts`（22 个函数统一封装）|
| 2 | CSS Modules 未使用 | TabBar、FormatToolbar、ModeSwitch、ThemeSelector 4 组件已迁移 |
| 3 | FileService 类缺失 | 创建 `electron/services/file-service.ts`（10 个方法）|
| 4 | markdown-it-texmath 未使用 | 替换 `PreviewPane` 自研 KaTeX DOM 遍历 |
| 5 | 搜索串行 — 可用 Promise.all 并行 | `search-service.ts` 8 并发度 Promise.all 分批 |
| 6 | hljs 主题依赖外部 CDN | 改为 `import` 静态 CSS + `disabled` 属性切换 |
| 7 | 两套插件系统冗余 | 删除 `plugin-manager.ts`（死代码）|
| 8 | app-store 文件状态冗余 | 移除 9 个文件字段，由 tab-store 统一管理 |
| 9 | IPC sanitizePath 重复 | `FileService.createFile/createDir` 吸收对话框逻辑 |
| 10 | 大文件限制未落实 | `PreviewPane` 大文件跳过 Mermaid 渲染 |

---

## 总计

- **审查发现**：22 项问题
- **已修复**：22/22 ✅（100%）
- **无待处理项**
