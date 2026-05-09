# Confucius 项目全面代码审查报告

---

## 历次审查记录

### Round 1 审查（2026-05-03）

**审查范围**：Phase 1–6 核心功能 + 插件引擎 v3  
**状态**：全部 22 项已修复 ✅（详见本文底部历史记录）

---

## Round 2 审查（2026-05-09）

**审查人**：GitHub Copilot  
**审查范围**：`electron/` + `src/` + `plugins/` 全部源码，对照 `README.md`、`docs/` 全部设计文档  
**基线**：115 单元/集成测试通过，14 E2E 测试通过，lint 通过

---

## 一、功能完整性核查

对照 README 功能列表逐项核查：

| 功能 | 状态 | 备注 |
|------|------|------|
| 双栏实时预览 (split) | ✅ | `EditorLayout.tsx` + `PreviewPane.tsx` |
| WYSIWYG 即时渲染 | ⚠️ 部分 | 见下方「WYSIWYG 限制」说明 |
| 纯预览模式 (`Ctrl+Shift+O`) | ✅ | EditorLayout 三模式切换 |
| 格式化工具栏 | ✅ | `FormatToolbar.tsx` |
| CodeMirror 6 + 语法高亮 | ✅ | `cm6-setup.ts` |
| 代码高亮 190+ 语言 | ✅ | `highlight.js` |
| KaTeX 公式渲染 | ✅ | `markdown-it-texmath` |
| Mermaid 图表 | ✅ | `mermaid-renderer.ts` |
| GFM 任务列表/表格 | ✅ | `markdown-it-task-lists` |
| 专注模式 (F11) | ✅ | `focus-mode.ts` |
| 打字机模式 (F12) | ✅ | `typewriter-mode.ts` |
| 文件树侧边栏 | ✅ | `FileTreePanel.tsx` |
| 大纲面板 + 跳转 | ✅ | `OutlinePanel.tsx` |
| 全局搜索（防抖/并行） | ✅ | `SearchPanel.tsx` + `search-service.ts` |
| 文件新建/打开/保存/另存为 | ✅ | `FileService` + IPC |
| 右键菜单（新建/重命名/删除） | ✅ | `sidebar:context-menu` IPC |
| 拖拽打开 .md 文件 | ✅ | `main.ts` `open-file`/`second-instance` |
| 三主题切换 + 持久化 | ✅ | `themes/` + `theme-service.ts` |
| 可拖拽分栏 | ✅ | `ResizablePane.tsx` |
| 滚动同步 | ✅ | `sync-scroll.ts` |
| HTML / PDF 导出 | ✅ | `export-service.ts` |
| 状态栏 | ✅ | `StatusBar.tsx` |
| 插件引擎（沙箱/依赖/事件/配置/UI） | ✅ | `PluginEngine.ts` + 周边模块 |
| 内置插件：文档模板 | ✅ | `plugins/builtins/doc-templates/` |
| 内置插件：代码运行器 | ✅ | `plugins/builtins/code-runner/` |
| 内置插件：文档统计 | ⚠️ | 见下方说明 |
| 内置插件：写作辅助 | ⚠️ | 见下方说明 |
| XSS 防护（DOMPurify） | ✅ | `sanitize.ts` |
| 路径安全校验 | ✅ | `FileService.sanitizePath()` |
| 编码检测（UTF-8/GBK/Shift-JIS） | ✅ | `encoding-detector.ts` |
| 多标签页 | ✅ | `TabBar.tsx` + `tab-store.ts` |
| CI/CD | ✅ | `.github/workflows/` |

### WYSIWYG 模式限制说明 ⚠️

`wysiwyg-plugin.ts` 目前仅处理以下元素的语法标记隐藏：标题(`#`)、加粗(`**`)、斜体(`*`)、删除线(`~~`)、行内代码(`` ` ``)、无序列表(`-`/`*`)、引用(`>`)。

**以下语法在 WYSIWYG 模式下不隐藏标记**：
- 链接 `[text](url)` — 方括号和圆括号保持可见
- 图片 `![alt](url)` — 同上
- 有序列表 `1. item`
- 表格 `| col |`
- 任务列表 `- [ ]`
- 代码块（三个反引号）
- 嵌套格式（如加粗斜体 `***text***`）

README 描述为「编辑区内隐藏语法标记，光标附近恢复显示」，技术上准确，但与 Typora 全量 WYSIWYG 体验有较大差距，建议在文档中明确说明当前覆盖范围。

### 文档统计 / 写作辅助说明 ⚠️

README「内置插件」章节列出了「文档统计」和「写作辅助」，但实际代码中这两个插件位于 `plugins/doc-stats/` 和 `plugins/writing-aid/`（示例/用户插件目录），**不在** `plugins/builtins/` 中，不会随应用自动激活。用户需手动通过插件管理 UI 加载。建议：
- 将其移入 `plugins/builtins/`，或
- 更新 README 说明其为「示例插件」

---

## 二、安全隐患

### 🔴 高危

#### S-01：代码运行器 JavaScript 执行缺乏真正隔离

**文件**：`plugins/builtins/code-runner/index.js` → `runJavaScript()`

```js
const sandboxFunc = new Function(`"use strict";\n${code}`)
sandboxFunc()
```

`new Function` 在渲染进程中执行，**不提供任何沙箱隔离**。恶意代码可通过原型链访问真实全局对象：

```js
// 逃逸示例（在严格模式下仍可行）
const win = [].constructor.constructor('return window')()
const api = win.electronAPI
// 现在可以调用 api.writeFile / api.deleteItem 等 IPC
```

这意味着 Markdown 文档中的 JS 代码块，一旦点击"运行"，可以**读取、写入、删除用户任意文件**，无任何确认提示。

**Python 执行**（通过 `ipc-handlers.ts`）有弹窗确认机制，JS 执行没有。

**建议**：
1. 为 JS 执行添加与 Python 相同的用户确认弹窗
2. 考虑在独立的 Node.js `vm` 模块沙箱中执行（主进程侧），或使用 Worker 线程
3. 至少明确禁用 `window.electronAPI` 相关的代码路径

---

### 🟡 中危

#### S-03：Content Security Policy（CSP）未设置

**文件**：`electron/main.ts` → `createMainWindow()`

Electron 主窗口未通过 `webPreferences` 或 HTTP 响应头配置 CSP。尽管已设置 `contextIsolation: true` 和 `nodeIntegration: false`，缺少 CSP 意味着：
- 插件注入的内联 `<script>` 可执行
- `<style>` 注入无限制

**建议**：添加 CSP 响应头，至少限制 `script-src 'self'`：

```ts
mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"]
    }
  })
})
```

---

### 🟢 低危 / 建议改进

#### S-06：正则搜索存在 ReDoS 风险

**文件**：`electron/services/search-service.ts`

当用户开启「正则模式」时，输入的正则直接编译并执行：

```ts
const pattern = options?.regex
  ? new RegExp(query, flags)
  : new RegExp(escapeRegex(query), flags)
```

精心构造的正则（如 `(a+)+$`）会导致主进程线程阻塞，进而冻结整个应用。对本地单用户应用影响有限，但仍建议：添加超时机制（`worker_threads` + `AbortController`）或限制正则复杂度。

---

#### S-07：`style` 属性在 DOMPurify 白名单中

**文件**：`src/utils/sanitize.ts`

`ALLOWED_ATTR` 包含 `style`，允许 HTML 内联样式。攻击者可通过精心构造的 Markdown 注入视觉遮挡、隐藏内容或 CSS 钓鱼效果。在本地编辑器场景下影响极低，但建议从白名单中移除 `style` 或通过 `DOMPurify.addHook` 对 style 值做二次过滤。

---

#### S-08：Electron 版本偏旧（28.x）

**文件**：`package.json`

当前锁定 `"electron": "^28.3.3"`，Electron 最新稳定版为 33.x。旧版包含的 Chromium/Node.js 已有多个已知 CVE。Future-Roadmap 已将升级列为目标，建议尽快推进至 Electron 33+。

---

## 三、代码质量问题

| # | 文件 | 问题 | 建议 |
|---|------|------|------|
| Q-01 | `src/editor/markdown-renderer.ts` | 多处使用 `any` 类型（标注 `eslint-disable`） | 替换为精确类型，消除 eslint 抑制注释 |
| Q-02 | `src/components/` 大多数组件 | 仍使用全局 CSS，未迁移到 CSS Modules | 计划性迁移剩余组件 |
| Q-03 | `electron/services/file-service.ts` → `buildFileTree()` | root 节点的 `path` 字段使用原始 `rootPath`（未经过 `sanitizePath`），与 children 不一致 | 改为 `safePath` |
| Q-04 | `electron/ipc-handlers.ts` → `findPythonPath()` | 函数始终返回白名单第一项 `'python'`，白名单检查实际上无效；注释称「打包环境可能需要检查常见路径」但未实现 | 实现完整路径探测逻辑，或移除空函数 |
| Q-05 | `src/engine/SandboxFactory.ts` | 执行的代码必须使用 `module.exports`，但错误信息不够清晰，调试插件时体验差 | 改善错误消息，增加更具体的字段缺失提示 |

---

---

## 五、总结

| 类别 | 数量 | 状态 |
|------|------|------|
| 功能基本完整 | Phase 1–6 全部 ✅ | — |
| 功能待完善 | 1 项（WYSIWYG 覆盖范围） | 待处理 |
| 安全隐患：高危 | 1 项（S-01） | ⚠️ 建议优先修复 |
| 安全隐患：中危 | 1 项（S-03） | 待处理 |
| 安全隐患：低危 | 2 项（S-06、S-07）+ Electron 版本 | 可计划处理 |
| 代码质量 | 5 项（Q-01 ~ Q-05） | 待处理 |
| 文档一致性 | 0 项 | ✅ 已修复 |

**最高优先级修复建议**：
1. **S-01**：为 JS 代码运行添加与 Python 相同的用户确认弹窗（1 小时内可完成）
2. **S-03**：添加 CSP 响应头（30 分钟）

---

## 附：Round 1 历史记录（2026-05-03，22 项全部已修复）

### Phase05-2 修复项

| 类别 | 问题 | 修复方式 |
|------|------|---------|
| 专注模式 | 非活动行置灰 | `focus-mode.ts` + CSS |
| 打字机模式 | 编辑行视口居中 | `typewriter-mode.ts` — CM6 updateListener |
| 菜单 | F11/F12 快捷键 | `menu.ts` 视图菜单添加 checkbox 项 |
| DOM 增量 | 预览全量 innerHTML 闪烁 | `morphdom` 增量更新 |
| XSS 防护 | `html: true` 允许注入 | `DOMPurify` 白名单过滤 |
| KaTeX 误渲染 | 代码块内 $ 被渲染 | `isInsideCode()` 检查 |
| 大文件检测 | >1MB 文件性能 | `large-file-handler.ts` |
| macOS Cmd+W | 关闭窗口处理 | `menu.ts` 发送 `file:close` |
| PDF 代码块换行 | 导出后代码块溢出 | `export-service.ts` `white-space: pre-wrap` |
| 侧边栏宽度 | 重启后丢失 | `sidebar-store.ts` localStorage 持久化 |
| 编码检测 | GBK 文件乱码 | `encoding-detector.ts` — BOM/jschardet/iconv-lite |
| PDF 导出延迟 | 硬编码 500ms | `waitForPageReady()` 事件驱动 |

### 技术债务修复项

| # | 问题 | 修复方式 |
|---|------|---------|
| 1 | services 层缺失 | 创建 `src/services/electron-bridge.ts` |
| 2 | CSS Modules 未使用 | 4 组件迁移 |
| 3 | FileService 类缺失 | 创建 `electron/services/file-service.ts` |
| 4 | markdown-it-texmath 未使用 | 替换自研 KaTeX DOM 遍历 |
| 5 | 搜索串行 | `search-service.ts` 8 并发 Promise.all |
| 6 | hljs CDN 依赖 | 改为静态 import |
| 7 | 两套插件系统冗余 | 删除 `plugin-manager.ts` |
| 8 | app-store 文件状态冗余 | 移除 9 个冗余字段 |
| 9 | IPC sanitizePath 重复 | FileService 吸收 |
| 10 | 大文件限制未落实 | PreviewPane 大文件跳过 Mermaid |
