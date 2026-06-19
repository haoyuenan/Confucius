# 短期优化方案设计文档

> 日期: 2026-06-19 | 状态: Draft | 作者: AI + renfy

## 一、概述

在 1-3 个月内完成 5 个方向的建设，按优先级排序：

| # | 方向 | 核心产出 | 估算工期 | 优先级理由 |
|---|------|---------|---------|-----------|
| 1 | 知识库索引迁移到 Rust | 新 Rust 模块 + 5 个 IPC 命令 + 前端渐进切换 | 2 周 | 性能基础设施，解锁后续优化 |
| 2 | Tantivy 全文搜索引擎 | 替换现有 `search_text`，新增增量索引 | 2 周 | 大知识库搜索从秒级到毫秒级 |
| 3 | 虚拟滚动 | use-virtual-list hook + FileTree/Search 改造 | 2 周 | 大项目可用性保障 |
| 4 | 模板系统 | `.confucius/templates/` + 新建文件对话框 | 2 周 | 低投入高回报，日常笔记刚需 |
| 5 | AI 辅助写作 (Ollama) | 选中文本 → AI 菜单（翻译/摘要/改写/扩展） | 2 周 | 编辑器从工具到助手的质变 |

**i18n 策略**：每完成一个功能模块，立即更新 `zh.json` 和 `en.json`。

---

## 二、架构变更概览

```
当前架构:
  ┌──────────┐  IPC   ┌────────────────┐
  │  React   │◄──────►│  Rust (lib.rs) │
  │  前端    │        │  15 commands   │
  └────┬─────┘        │  + fs watcher  │
       │              └────────────────┘
       │ JS层
  ┌────┴──────────────┐
  │ knowledge-service │ 448行 JS
  │ (索引/搜索/标签)  │
  └───────────────────┘

目标架构:
  ┌──────────┐  IPC   ┌──────────────────────────────┐
  │  React   │◄──────►│  Rust 后端                   │
  │  前端    │        │  ├─ 现有 15 commands         │
  └────┬─────┘        │  ├─ knowledge/  模块 (新增)  │
       │              │  ├─ search/     模块 (新增)  │
  ┌────┴──────────────┐  └─ lib.rs 保持兼容          │
  │ ai-service.ts     │  └──────────────────────────────┘
  │ template-service  │
  │ use-virtual-list  │
  └───────────────────┘
```

**关键设计约束**：
- 新代码不与现有逻辑耦合，通过新 IPC 命令暴露
- 前端通过 Zusstand store 切换数据源（JS vs Rust）
- 所有 Rust 模块有独立单元测试

---

## 三、模块一：知识库索引迁移到 Rust

### 3.1 目标

将 `src/services/knowledge-service.ts`（448行 JS）的核心索引逻辑迁移到 Rust，通过新 IPC 命令供前端调用。

### 3.2 现有瓶颈

- 每个文件需要通过 IPC 逐文件读取 + JS 正则解析（wikilinks、tags、frontmatter）
- 增量同步（`syncChanges()`）需要遍历全部文件检查变更
- 1000+ 文件时 `fullScan()` 需要数十秒
- `searchFiles()` 线性扫描 `Object.entries(this.index.files)`

### 3.3 新增模块结构

```
src-tauri/src/knowledge/
  ├── mod.rs          # 模块入口，注册 #![tauri::command]
  ├── indexer.rs      # 索引构建（全量 + 增量）
  ├── parser.rs       # wikilinks/tags/frontmatter 解析
  ├── resolver.rs     # 链接解析 + 反向链接图
  └── types.rs        # 数据结构
```

### 3.4 数据结构（Rust + serde）

```rust
#[derive(Serialize, Deserialize, Clone)]
struct KnowledgeIndex {
    version: u32,
    files: HashMap<String, FileMeta>,
    links: Vec<Link>,
    tags: HashMap<String, Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone)]
struct FileMeta {
    path: String,
    title: String,
    pub links: Vec<String>,
    pub linked_from: Vec<String>,
    pub tags: Vec<String>,
    created: String,
    modified: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct Link {
    source: String,
    target: String,
    resolved: bool,
    target_path: Option<String>,
}
```

### 3.5 新增 IPC 命令（5 个）

| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `knowledge_init` | `workspace_path: String` | `()` | 初始化索引（增量同步或全量扫描） |
| `knowledge_get_backlinks` | `file_path: String` | `{ linked: Vec<Link> }` | 获取指定文件的反向链接 |
| `knowledge_get_graph` | `file_path: Option<String>` | `{ nodes: Vec<String>, links: Vec<Link> }` | 全局/局部图谱数据 |
| `knowledge_get_tags` | 无 | `HashMap<String, Vec<String>>` | 全部标签及其关联文件 |
| `knowledge_reindex` | `file_path: String` | `()` | 重新索引单个文件（文件变更时） |

### 3.6 迁移策略

1. **第 1 步**：Rust 模块独立开发 + `#[cfg(test)]` 单元测试
2. **第 2 步**：`bridge.ts` 新增 Rust 版 IPC wrapper（如 `knowledge_init` → `invoke('knowledge_init')`）
3. **第 3 步**：`knowledge-store.ts` 新增 `useRustBackend` 开关，默认走 JS，可通过 localStorage `confucius-knowledge-backend: "rust"` 切换
4. **第 4 步**：在 `lib.rs` 注册命令 + 更新 `generate_handler![]`
5. **第 5 步**：稳定后（观察 2 周无问题），移除 JS 版 `KnowledgeService`，`bridge.ts` 清理冗余 wrapper

### 3.7 索引文件兼容

- `index.json` 格式保持不变（JSON 序列化）
- 两个实现可以读写同一份索引文件
- 切换回 JS 版时数据无损

### 3.8 i18n 影响

无新增用户可见文案（后端索引逻辑无 UI）。

---

## 四、模块二：Tantivy 全文搜索引擎

### 4.1 目标

用 Tantivy（Rust 版 Lucene）替换 `lib.rs` 中 `search_text` 的线性 regex 扫描。

### 4.2 现状

`lib.rs:126-218`：
- 多线程 + `regex::Regex` 逐行扫描所有 `.md` 文件
- 无倒排索引，每次搜索都要读取全部文件
- 不支持中文分词
- 不支持字段限定搜索

### 4.3 新增模块结构

```
src-tauri/src/search/
  ├── mod.rs         # 模块入口
  ├── indexer.rs     # Tantivy 索引写入（全量 + 增量）
  ├── searcher.rs    # 搜索查询（BM25 排序 + 高亮）
  └── schema.rs      # 文档 Schema 定义
```

### 4.4 Schema 设计

| 字段名 | Tantivy 类型 | 存储 (STORE) | 索引 (INDEXED) | 说明 |
|--------|-------------|-------------|---------------|------|
| `file_path` | Text（raw） | yes | yes | 完整路径，exact match 用 |
| `file_name` | Text（raw） | yes | no | 文件名，仅显示用 |
| `content` | Text（tokenized） | no | yes | 全文搜索，中文用 lindera 分词 |
| `title` | Text（raw + tokenized） | yes | yes | 标题，同时支持 exact/fuzzy |
| `tags` | Text（raw） | yes | yes | 逗号分隔，支持 `tag:XXX` 过滤 |
| `modified` | Text | yes | no | 修改时间，仅显示用 |

### 4.5 中文分词

使用 `lindera` crate（日文/中文形态素分析器），支持：
- IPADIC 词库
- 中文简体/繁体 Tokenizer

```toml
# Cargo.toml 新增依赖
tantivy = "0.22"
lindera = "0.35"
lindera-tantivy = "0.27"
```

### 4.6 搜索查询支持

| 查询类型 | 示例 | 实现 |
|----------|------|------|
| 关键词搜索 | `项目 设计` | Tantivy QueryParser AND 连接 |
| 模糊匹配 | `projct~1` | FuzzyTermQuery (编辑距离 ≤1) |
| 标签过滤 | `tag:日记` | TermQuery on `tags` field |
| 标题搜索 | `title:项目` | TermQuery on `title` field |
| 正则搜索 | 降级到原始 `search_text` | 当 `use_regex: true` 时走旧路径 |

### 4.7 替换方案

- `search_text` Rust command 内部改为调用 Tantivy searcher
- 签名不变：`search_text(root_path, query, case_sensitive, use_regex, max_results) -> Vec<SearchResult>`
- 前端 `bridge.ts` 的 `searchQuery()` 无需任何修改
- 正则搜索（`use_regex: true`）走回退路径（保留现有 regex 逻辑）

### 4.8 索引维护

- **全量重建**：`knowledge_init` 完成后自动触发
- **增量更新**：文件变更时 `knowledge_reindex` 同时更新 Tantivy 索引
- **索引存储**：`.confucius/tantivy/` 目录（Tantivy 原生文件格式）
- **索引大小预估**：1000 个 10KB 文件，索引约 15-25MB

### 4.9 与知识库搜索的关系

本项目有两条搜索通路：

| 通路 | 命令 | 搜索范围 | 模块二影响 |
|------|------|---------|-----------|
| 全文搜索 | `search_text` → `bridge.searchQuery()` | 文件内容（文本扫描） | **替换为此模块** |
| 文件名/标题搜索 | `knowledgeSearchFiles()` | 知识库索引中文件名+标题 | **不受影响**（模块一加速） |

### 4.10 i18n 影响

无新增用户可见文案（搜索 API 签名不变）。

---

## 五、模块三：虚拟滚动

### 5.1 目标

文件树和搜索结果支持 10000+ 条目不卡顿。

### 5.2 现状

- `FileTreePanel.tsx:207` — `.map()` 直接渲染全部 `flatItems`
- `SearchPanel.tsx:124` — `.map()` 直接渲染全部 `searchResults`
- 500+ 条目时 DOM 节点过多，交互卡顿

### 5.3 设计方案

**不引入新依赖**。实现约 80 行的轻量虚拟滚动 hook。

### 5.4 导出 hook

```typescript
// src/hooks/use-virtual-list.ts

interface UseVirtualListOptions {
  itemHeight: number       // 每个条目的固定高度 (px)
  overscan?: number        // 预渲染额外行数 (默认 5)
  totalCount: number       // 总条目数
  scrollContainerRef: React.RefObject<HTMLElement>
}

interface VirtualListResult {
  offsetY: number          // 第一个可见条目的 Y 偏移
  startIndex: number       // 第一个可见条目的索引
  visibleItems: number[]   // 需要渲染的条目索引数组
  totalHeight: number      // 总高度（撑起滚动条）
}
```

### 5.5 核心算法

1. 监听容器 `scroll` 事件，记录 `scrollTop`
2. `startIndex = Math.floor(scrollTop / itemHeight)`
3. `visibleCount = Math.ceil(containerHeight / itemHeight) + overscan`
4. 只渲染 `[startIndex, startIndex + visibleCount]` 范围内的条目
5. 用 `paddingTop = startIndex * itemHeight` + `paddingBottom` 撑起总高度

### 5.6 改造范围

| 文件 | 改动 | 说明 |
|------|------|------|
| `src/hooks/use-virtual-list.ts` | 新增 | 可复用 hook |
| `src/components/Sidebar/FileTreePanel.tsx` | 修改 | `flatItems.map()` → 虚拟列表 |
| `src/components/Sidebar/SearchPanel.tsx` | 修改 | `searchResults.map()` → 虚拟列表 |

### 5.7 i18n 影响

无新增用户可见文案。

---

## 六、模块四：模板系统

### 6.1 目标

新建文件时可选择模板，模板支持 `{{date}}`、`{{title}}` 等占位符。

### 6.2 模板存储

```
.confucius/templates/
  ├── 日记.md          # 每日笔记
  ├── 周报.md          # 工作周报
  ├── 会议记录.md       # 会议纪要
  └── 读书笔记.md       # 阅读笔记
```

### 6.3 预置模板内容

**日记.md**:
```markdown
---
title: {{date}} 日记
date: {{date}}
tags: [日记]
---

# {{date}}

## 今日计划

- [ ] 

## 今日记录

## 反思
```

**会议记录.md**:
```markdown
---
title: 会议记录 - {{date}}
date: {{date}}
tags: [会议]
---

# 会议记录

**日期**：{{date}}
**参会人**：
**主题**：

## 讨论内容

## 决定事项

- [ ] 

## 待办事项

- [ ] 
```

### 6.4 占位符

| 占位符 | 来源 | 示例 |
|--------|------|------|
| `{{date}}` | `new Date().toISOString().slice(0,10)` | `2026-06-19` |
| `{{time}}` | `new Date().toTimeString().slice(0,8)` | `14:30:00` |
| `{{title}}` | 用户输入的文件名（不含扩展名） | `项目复盘` |
| `{{year}}` | `new Date().getFullYear()` | `2026` |
| `{{month}}` | `String(now.getMonth()+1).padStart(2,'0')` | `06` |
| `{{day}}` | `String(now.getDate()).padStart(2,'0')` | `19` |

### 6.5 实现

**新增文件**：

| 文件 | 说明 |
|------|------|
| `src/services/template-service.ts` | 模板列表加载、占位符展开、预置模板生成 |

**修改文件**：

| 文件 | 改动 |
|------|------|
| `src/components/DailyNoteButton.tsx` | 改为通用"新建笔记"按钮，点击弹出模板选择器 |
| 新增 `src/components/TemplatePicker.tsx` | 模板选择对话框组件（列表 + 文件名输入） |

### 6.6 交互流程

```
点击"新建笔记"
    │
    ▼
弹出对话框:
  ├── 模板列表（从 .confucius/templates/ 读取）
  ├── 文件名输入框
  └── 确认/取消
    │
    ▼
确认 →
  1. 计算目标路径（当前 file tree 选中目录 + 文件名）
  2. 读取模板内容 + 展开占位符
  3. invoke('create_file') 创建空文件
  4. invoke('write_file_utf8') 写入展开后内容
  5. useTabStore.openFile() 打开新文件
```

### 6.7 首次运行

- 如果 `.confucius/templates/` 不存在，`template-service.ts` 自动创建并写入 4 个预置模板
- 用户可自由编辑、删除、新增模板文件

### 6.8 i18n 新增文案

需要翻译的键：
- `template.picker.title` — 选择模板
- `template.picker.fileName` — 文件名
- `template.picker.create` — 创建
- `template.picker.cancel` — 取消
- `app.toolbar.newNote` — 新建笔记（替换原有的"每日笔记"）

---

## 七、模块五：AI 辅助写作（Ollama）

### 7.1 目标

编辑器选中文本后，通过 Ollama 本地模型提供翻译、摘要、改写、扩展四个 AI 操作。

### 7.2 架构

纯前端模块。通过 `fetch` 直接调用 Ollama HTTP API（默认 `http://localhost:11434`），不经过 Rust 后端。

### 7.3 新增文件

| 文件 | 说明 |
|------|------|
| `src/services/ai-service.ts` | Ollama API 封装（generate、list models、health check） |
| `src/editor/ai-tooltip-plugin.ts` | CM6 扩展：选区浮动菜单 + AI 操作触发 |

### 7.4 ai-service.ts API 封装

```typescript
interface AIConfig {
  endpoint: string   // 默认 "http://localhost:11434"
  model: string      // 默认 "qwen2.5:7b"
  language: 'zh' | 'en' // 翻译目标语言
}

interface AIStreamCallback {
  onToken: (token: string) => void
  onDone: (fullText: string) => void
  onError: (error: Error) => void
}

// 流式调用 Ollama /api/generate
async function streamGenerate(
  config: AIConfig,
  prompt: string,
  systemPrompt: string,
  callback: AIStreamCallback
): Promise<void>

// 检查 Ollama 服务是否可用
async function checkOllamaHealth(endpoint: string): Promise<boolean>

// 获取可用模型列表
async function listModels(endpoint: string): Promise<string[]>
```

### 7.5 交互流程

```
用户在编辑器中选中文本
    │
    ▼
CM6 SelectionUpdate → 浮动菜单出现在选区上方/下方
  ├── [翻译] → 自动检测语言，译为中文/英文
  ├── [摘要] → 提取要点，3-5 句
  ├── [改写] → 优化表达，保持原意
  └── [扩展] → 深入展开论述
    │
    ▼
点击操作 →
  1. 显示 loading 状态（spinner）
  2. 调用 Ollama streamGenerate
  3. 流式追加文本到编辑器（插入到选区位置）
  4. 完成 → 隐藏 loading
```

### 7.6 CM6 集成方案

`ai-tooltip-plugin.ts` 实现为 CM6 ViewPlugin：

1. 监听 `EditorView.updateListener` 中的 selection 变化
2. 当有非空选区时，计算选区位置 → 显示浮动菜单 Tooltip
3. 菜单使用 CM6 的 `Tooltip` facet 而非 DOM overlay（保证主题兼容）
4. AI 操作完成后，通过 `view.dispatch({ changes: { from, to, insert } })` 替换/追加文本

### 7.7 Prompt 设计

**翻译**：
```
SYSTEM: You are a translation assistant. Translate the following text to {target_language}. Return only the translated text, no explanations.
USER: {selected_text}
```

**摘要**：
```
SYSTEM: You are a summarization assistant. Extract the key points from the following text in 3-5 concise sentences. If the text is in Chinese, respond in Chinese. Return only the summary, no explanations.
USER: {selected_text}
```

**改写**：
```
SYSTEM: You are a writing assistant. Improve the following text for clarity and fluency while preserving the original meaning. If the text is in Chinese, respond in Chinese. Return only the improved text, no explanations.
USER: {selected_text}
```

**扩展**：
```
SYSTEM: You are a writing assistant. Expand on the following text to provide more depth, examples, and elaboration. Maintain the same tone and language as the input. Return only the expanded text, no explanations.
USER: {selected_text}
```

### 7.8 Ollama 不可用时的处理

1. 首次触发 AI 操作时，`checkOllamaHealth()` 检测 `/api/tags` 是否可达
2. 不可达时弹出提示对话框：
   - 标题：Ollama 未连接
   - 内容：请确认 Ollama 已安装并运行。可访问 https://ollama.com 下载。
   - 按钮：「重试连接」「稍后」
3. 连接成功但无可用模型时提示 `ollama pull qwen2.5:7b`

### 7.9 配置管理

存储位置：`localStorage` key `confucius-ai-config`

首次使用自动弹出配置界面：
- Ollama 地址（默认 `http://localhost:11434`）
- 模型选择（从 `/api/tags` 获取列表）
- 测试连接按钮

### 7.10 i18n 新增文案

需要翻译的键：
- `ai.menu.translate` — 翻译
- `ai.menu.summarize` — 摘要
- `ai.menu.rewrite` — 改写
- `ai.menu.expand` — 扩展
- `ai.config.title` — AI 设置
- `ai.config.endpoint` — Ollama 地址
- `ai.config.model` — 模型
- `ai.config.test` — 测试连接
- `ai.config.save` — 保存
- `ai.noConnection` — Ollama 未连接
- `ai.noConnectionHint` — 请确认 Ollama 已安装并运行
- `ai.retry` — 重试连接
- `ai.later` — 稍后
- `ai.noModel` — 未找到可用模型，请运行 ollama pull {model}
- `ai.loading` — AI 处理中...

---

## 八、实施计划

### 8.1 顺序与依赖

```
第 1-2 周  模块一：知识库索引 Rust 版
              ├─ 产出：5 个新 IPC commands + Rust 测试
              └─ 依赖：无

第 3-4 周  模块二：Tantivy 搜索引擎
              ├─ 产出：倒排索引搜索替换 regex 扫描
              ├─ 依赖：模块一（共享 .confucius/index.json）
              └─ 前端零改动

第 5-6 周  模块三：虚拟滚动
              ├─ 产出：use-virtual-list hook + FileTree/Search 改造
              └─ 依赖：无

第 7-8 周  模块四：模板系统
              ├─ 产出：模板选择对话框 + 占位符展开 + 预置模板
              └─ 依赖：现有的 create_file/writeFile Rust commands

第 9-10 周 模块五：AI 辅助写作
              ├─ 产出：ai-service.ts + CM6 浮动菜单插件
              └─ 依赖：无（纯前端独立模块）

第 11-12 周 联调 + E2E 测试 + 清理
              ├─ JS 版 knowledge-service 切换开关验证
              ├─ 全模块 E2E 测试
              └─ 移除 JS 知识库版（条件触发）
```

### 8.2 每条原则

1. **每模块完成后立即提交**，不跨模块攒 commit
2. **每模块完成后立即更新 i18n**（`zh.json` + `en.json`）
3. **每个 Rust 模块必须有单元测试**（`#[cfg(test)]`）
4. **每个前端模块必须有 E2E 覆盖关键路径**
5. **所有新代码遵循项目风格**：无分号、单引号、trailing commas

### 8.3 验证标准

| 模块 | 验证指标 |
|------|---------|
| 知识库 Rust | 1000 文件 fullScan < 3s（原 > 20s）；单元测试通过 |
| Tantivy | 1000 文件搜索 < 100ms（原 > 2s）；BM25 排序合理性 |
| 虚拟滚动 | 10000 条目渲染 < 200 DOM 节点；滚动流畅 60fps |
| 模板系统 | 4 个预置模板自动创建；占位符正确展开 |
| AI 写作 | 4 个操作全部可用；Ollama 不可用时正确降级提示 |

---

## 九、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Tantivy 中文分词效果差 | 搜索结果不准 | 先用 raw tokenizer 回退；lindera IPADIC 有中文基础词表 |
| Tantivy 索引文件过大 | 磁盘占用高 | 不存储 content 字段；索引关闭压缩 |
| CM6 Tooltip 与现有扩展冲突 | 浮动菜单位置异常 | 使用单独的 ViewPlugin，测试 split/wysiwyg/preview 三种模式 |
| Ollama 响应慢（>5s） | 用户体验差 | 流式返回 + 取消按钮 + loading 动画 |
| 知识库 Rust 版与 JS 版结果不一致 | 数据差异 | 编写集成测试对比两个实现的输出，以 JS 版为 reference |
