# 多格式导入设计文档

> 日期: 2026-06-19 | 状态: Draft | 方向 E：多格式支持 — 导入子项

## 一、目标

支持从 Word (.docx)、PDF、HTML、EPUB 四种格式导入并转换为 Markdown，作为新笔记写入知识库。

## 二、方案选择

### 2.1 三种路径对比

| 方案 | 原理 | 优势 | 劣势 |
|------|------|------|------|
| **A. Pandoc** | Rust `std::process::Command` 调用 pandoc CLI | 质量业界最高，4 格式全覆盖，成熟稳定 | 需用户安装 pandoc（或捆绑分发） |
| **B. 纯 Rust crate** | `docx-rs` / `html2md` / `pdf-extract` / `epub` | 自包含，零外部依赖 | 每格式单独 crate，质量参差，PDF 最差 |
| **C. 前端 JS 库** | `mammoth` / `turndown` / `pdf.js` | 不改 Rust 端 | PDF 浏览器端极难，大文件内存风险 |

### 2.2 推荐方案：Pandoc 优先 + 格式专用降级

```
                  ┌── pandoc 已安装? ───┐
                  │                      │
                  │ 是                   │ 否
                  ▼                      ▼
         全格式 pandoc 转换       ┌── Word  ─── docx-rs 降级
         最佳质量                │
                                ├── HTML  ─── html2md 降级
                                │
                                ├── EPUB  ─── 解压 ZIP → HTML → html2md
                                │
                                └── PDF  ─── pdf-extract（纯文本提取）
                                              提示安装 pandoc 获更好效果
```

- **检测 pandoc**：首次导入时尝试 `pandoc --version`，结果缓存到 `localStorage`
- **pandoc 可用**：一次命令完成，质量最佳
- **pandoc 不可用**：格式专用 crate 降级，显示质量提示

### 2.3 格式转换质量预估

| 格式 | Pandoc | Rust fallback | Fallback 局限 |
|------|--------|--------------|--------------|
| Word (.docx) | ★★★★★ 完美 | ★★★☆☆ 可读 | docx-rs 丢表格/图片/样式 |
| HTML | ★★★★★ 完美 | ★★★★☆ 良好 | html2md 不支持复杂嵌套 |
| EPUB | ★★★★★ 完美 | ★★★☆☆ 可读 | 章节顺序可能错乱 |
| PDF | ★★★☆☆ 尚可 | ★★☆☆☆ 基本可用 | pdf-extract 丢排版/表格 |

## 三、架构设计

### 3.1 新增文件

```
src-tauri/src/import.rs          # Rust 导入逻辑
src/services/import-service.ts   # 前端导入服务（对话框、进度、错误处理）
src/i18n/zh.json                 # 导入相关文案
src/i18n/en.json                 # " (翻译)
```

### 3.2 新增 Cargo 依赖（仅 fallback crate）

```toml
# 仅在 pandoc 不可用时使用
docx-rs = { version = "0.4", optional = true }
html2md = "0.2"
pdf-extract = "0.7"
zip = { version = "0.6", optional = true }     # 用于 EPUB 解压
```

注：可考虑用 Cargo feature flag 控制，让大部分用户只需 pandoc 路径。

### 3.3 Rust 端：`src-tauri/src/import.rs`

```rust
use std::path::Path;
use std::process::Command;

/// 检测 pandoc 是否可用
pub fn pandoc_available() -> bool {
    Command::new("pandoc")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// 通过 pandoc 转换任意格式到 Markdown
fn convert_via_pandoc(input: &str, from_format: &str) -> Result<String, String> {
    let output = Command::new("pandoc")
        .args([input, "-f", from_format, "-t", "markdown", "--wrap=none"])
        .output()
        .map_err(|e| format!("pandoc 执行失败: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// 转换 Word .docx → Markdown
fn docx_to_md(input: &str) -> Result<String, String> {
    if pandoc_available() {
        return convert_via_pandoc(input, "docx");
    }
    // Fallback: docx-rs 逐段落提取
    // let docx = docx_rs::read_docx(&std::fs::read(input)?)?;
    // ...
    Err("Word fallback 未实现（需 docx-rs crate）".into())
}

/// 转换 HTML → Markdown
fn html_to_md(input: &str) -> Result<String, String> {
    if pandoc_available() {
        return convert_via_pandoc(input, "html");
    }
    // Fallback: html2md
    let html = std::fs::read_to_string(input)
        .map_err(|e| format!("读取文件失败: {}", e))?;
    Ok(html2md::parse_html(&html))
}

/// 转换 EPUB → Markdown
fn epub_to_md(input: &str) -> Result<String, String> {
    if pandoc_available() {
        return convert_via_pandoc(input, "epub");
    }
    // Fallback: 解压 epub (zip) → 提取 .xhtml/.html → 逐个 html2md
    // ...
    Err("EPUB fallback 未实现".into())
}

/// 转换 PDF → Markdown
fn pdf_to_md(input: &str) -> Result<String, String> {
    if pandoc_available() {
        return convert_via_pandoc(input, "pdf");
    }
    // Fallback: pdf-extract 纯文本提取
    // let bytes = std::fs::read(input)?;
    // let text = pdf_extract::extract_text_from_mem(&bytes)?;
    // ...
    Err("PDF fallback 未实现".into())
}

/// 生成建议的输出文件名
fn suggested_name(input: &str) -> String {
    let path = Path::new(input);
    let stem = path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "导入文档".into());
    format!("{}.md", stem)
}

/// 入口函数：自动检测格式并转换
fn detect_format(input: &str) -> Result<&str, String> {
    let lower = input.to_lowercase();
    if lower.ends_with(".docx") { Ok("docx") }
    else if lower.ends_with(".html") || lower.ends_with(".htm") { Ok("html") }
    else if lower.ends_with(".epub") { Ok("epub") }
    else if lower.ends_with(".pdf") { Ok("pdf") }
    else { Err(format!("不支持的格式: {}", input)) }
}

fn convert_file(input: &str) -> Result<(String, String), String> {
    let format = detect_format(input)?;
    let md = match format {
        "docx" => docx_to_md(input)?,
        "html" => html_to_md(input)?,
        "epub" => epub_to_md(input)?,
        "pdf" => pdf_to_md(input)?,
        _ => unreachable!(),
    };
    Ok((md, suggested_name(input)))
}
```

### 3.4 新 IPC 命令

| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `check_pandoc` | 无 | `bool` | 前端调用判断是否显示安装提示 |
| `import_file` | `source_path: String` | `{ content: String, suggested_name: String }` | 转换文件并返回 Markdown |

在 `lib.rs` 的 `generate_handler![]` 中注册。

### 3.5 前端：`src/services/import-service.ts`

```typescript
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { writeFile, readFile } from './bridge'
import type { useTabStore } from '../stores/tab-store'

const IMPORT_FILTERS = [
  { name: '支持的文件', extensions: ['docx', 'pdf', 'html', 'htm', 'epub'] },
  { name: 'Word 文档', extensions: ['docx'] },
  { name: 'PDF', extensions: ['pdf'] },
  { name: '网页', extensions: ['html', 'htm'] },
  { name: '电子书', extensions: ['epub'] },
]

export async function checkPandocAvailable(): Promise<boolean> {
  return invoke('check_pandoc')
}

export async function importFileDialog(rootPath: string, openFile: (path: string, content: string) => void): Promise<void> {
  const selected = await open({
    multiple: false,
    filters: IMPORT_FILTERS,
  })
  if (!selected) return

  const sourcePath = selected as string
  try {
    const result = await invoke<{ content: string; suggestedName: string }>(
      'import_file',
      { sourcePath }
    )
    const targetPath = `${rootPath}/${result.suggestedName}`
    await writeFile(targetPath, result.content)
    const file = await readFile(targetPath)
    openFile(file.filePath, file.content)
  } catch (err) {
    console.error('导入失败:', err)
  }
}
```

### 3.6 前端入口：工具栏按钮 + 命令面板

- 工具栏新增"导入"按钮（`src/App.tsx` 中 toolbar 区域）
- 命令面板注册 `import:file` 命令
- 点击触发 → 文件对话框 → 转换 → 写入 → 打开

### 3.7 i18n 新增文案

`zh.json`:
```json
{
  "import.button": "导入",
  "import.buttonTitle": "从 Word/PDF/HTML/EPUB 导入为 Markdown",
  "import.noPandoc": "未检测到 pandoc，将使用基础转换（质量可能下降）",
  "import.noPandocHint": "安装 pandoc 可获得最佳转换质量：https://pandoc.org",
  "import.failed": "导入失败",
  "import.success": "导入完成：{name}"
}
```

## 四、实施计划

| 阶段 | 内容 | 工期 |
|------|------|------|
| Phase 1 | Pandoc 路径实现（HTML + Word + EPUB + PDF 全支持） | 2-3 天 |
| Phase 2 | Fallback crate 实现（HTML html2md 最优先） | 2-3 天 |
| Phase 3 | 前端对话框、工具栏、命令面板、i18n | 1-2 天 |
| Phase 4 | E2E 测试 + 错误处理 | 1 天 |

**总计约 1-2 周。**

### 实施顺序建议

```
Phase 1 (pandoc 路径):
  ├── 新增 src-tauri/src/import.rs（detect + pandoc convert）
  ├── 新增 check_pandoc + import_file IPC 命令
  ├── 注册到 lib.rs generate_handler![]
  └── 前端 import-service.ts + 工具栏按钮

Phase 2 (fallback crate):
  ├── html2md（最简单的 fallback，优先实现）
  ├── docx-rs（次优先）
  ├── epub（zip + html2md 组合）
  └── pdf-extract（最有挑战）

Phase 3 (前端完善):
  ├── 导入进度提示
  ├── pandoc 不可用时的引导弹出
  └── i18n

Phase 4 (测试):
  └── E2E: HTML/Word 文件导入测试
```

## 五、风险与缓解

| 风险 | 缓解 |
|------|------|
| pandoc 大文件转换耗时长 | 异步执行 + 进度提示；大文件（>50MB）警告 |
| pandoc Windows 安装路径不在 PATH | 允许用户配置 pandoc 路径（settings 面板） |
| PDF 转换质量不可控 | 前端提示"PDF 转换可能丢失排版"，推荐 HTML/Word |
| fallback crate API 不稳定 | 先实现 pandoc 路径发布，fallback 可后续迭代 |
| EPUB 包含外部资源引用 | 转换后提示用户检查图片等资源 |
