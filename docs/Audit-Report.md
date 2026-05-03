# Confucius 项目全面代码审查报告（精简版）

**审查日期**：2026-05-03  
**审查范围**：`electron/` + `src/` 全部源码，对照 `docs/` 下所有设计文档  
**备注**：已修复条目已删除，仅保留待处理项

---

## 一、Bug（1 项待处理）

| # | 级别 | 文件 | 问题 |
|---|------|------|------|
| 1 | P1 | `src/editor/wysiwyg-plugin.ts` | WYSIWYG 全量文档正则扫描，长文档高频输入时影响响应性能，需增量解析优化 |

---

## 二、实现与设计不符（5 项待重构）

| # | 设计文档 | 设计要求 | 实际实现 | 差异 |
|---|---------|---------|---------|------|
| 1 | Phase01 §2 | `services/` 层封装所有 IPC 通信 | 组件直接调 `window.electronAPI` | 无服务层 |
| 2 | Phase01 §1 | CSS Modules + CSS Variables | 纯全局 CSS | 无作用域隔离 |
| 3 | Phase02 §4.1 | `FileService` 类封装 | 独立函数 | 缺少类封装 |
| 4 | Phase03 §2.3 | `markdown-it-texmath` 处理公式 | 自定义 DOM 遍历 | 未使用已安装的插件 |
| 5 | Phase05-1 §7.1 | 模式切换用 key 重建 CM6 | 无 key 属性 | 条件渲染虽会重新挂载但不够可靠 |

---

## 三、潜在问题（4 项待处理）

### 性能

| # | 文件 | 描述 |
|---|------|------|
| 1 | `electron/services/search-service.ts` | 串行逐文件搜索，大量文件时响应慢 |
| 2 | `src/components/Preview/PreviewPane.tsx` | 每次内容变化全量 innerHTML + Mermaid + KaTeX 重渲染 |

### 安全

| # | 文件 | 描述 |
|---|------|------|
| 3 | `src/editor/markdown-renderer.ts` | `html: true` 允许 HTML 注入，待 Phase05-2 集成 DOMPurify |

---

## 四、汇总

| 类别 | 待处理 |
|------|--------|
| Bug | 1（WYSIWYG 性能优化） |
| 设计不符 | 5（架构级重构） |
| 性能 | 2 |
| 安全 | 1（DOMPurify Phase05-2 实现） |
| **合计** | **9** |

所有 P0 和 P2 Bug、可用性问题、类型安全问题已全部修复。剩余工作多为架构重构和性能优化，可在后续阶段按需推进。
