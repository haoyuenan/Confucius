use std::path::Path;
use std::process::Command;

/// Detect whether pandoc is installed and accessible
fn pandoc_available() -> bool {
    Command::new("pandoc")
        .arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Convert via pandoc CLI: `pandoc <input> -f <format> -t markdown --wrap=none`
fn convert_via_pandoc(input: &str, from: &str) -> Result<String, String> {
    let output = Command::new("pandoc")
        .args([input, "-f", from, "-t", "markdown", "--wrap=none"])
        .output()
        .map_err(|e| format!("pandoc 执行失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("pandoc 转换失败: {}", stderr));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Fallback: HTML → Markdown using regex-based conversion
fn html_to_md_fallback(input: &str) -> Result<String, String> {
    let html = std::fs::read_to_string(input)
        .map_err(|e| format!("读取文件失败: {}", e))?;
    let md = html2text::from_read(html.as_bytes(), 80);
    Ok(md)
}

/// Fallback: Word .docx → plain text (basic)
fn docx_to_md_fallback(input: &str) -> Result<String, String> {
    let data = std::fs::read(input).map_err(|e| format!("读取文件失败: {}", e))?;
    let text = docx_rs::read_docx(&data)
        .map_err(|e| format!("解析 docx 失败: {}", e))?
        .document
        .children
        .iter()
        .filter_map(|c| {
            if let docx_rs::DocumentChild::Paragraph(p) = c {
                Some(
                    p.children
                        .iter()
                        .filter_map(|r| {
                            if let docx_rs::ParagraphChild::Run(run) = r {
                                Some(
                                    run.children
                                        .iter()
                                        .filter_map(|rc| {
                                            if let docx_rs::RunChild::Text(t) = rc {
                                                Some(t.text.clone())
                                            } else {
                                                None
                                            }
                                        })
                                        .collect::<Vec<_>>()
                                        .join(""),
                                )
                            } else {
                                None
                            }
                        })
                        .collect::<Vec<_>>()
                        .join(""),
                )
            } else {
                None
            }
        })
        .collect::<Vec<_>>()
        .join("\n\n");

    Ok(text)
}

/// Fallback: PDF → requires pandoc (no native fallback available)
fn pdf_to_md_fallback(_input: &str) -> Result<String, String> {
    Err("PDF 转换需要 pandoc。请安装 pandoc 后重试: https://pandoc.org".into())
}

/// Fallback: EPUB → extract HTML chapters and convert
fn epub_to_md_fallback(input: &str) -> Result<String, String> {
    let file = std::fs::File::open(input).map_err(|e| format!("打开文件失败: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("解析 EPUB 失败: {}", e))?;

    let mut result = String::new();

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("读取条目失败: {}", e))?;
        let name = entry.name().to_lowercase();

        if name.ends_with(".xhtml") || name.ends_with(".html") || name.ends_with(".htm") {
            let mut content = String::new();
            std::io::Read::read_to_string(&mut entry, &mut content)
                .map_err(|e| format!("读取章节失败: {}", e))?;

            let md = html2text::from_read(content.as_bytes(), 80);
            if !md.trim().is_empty() {
                if !result.is_empty() {
                    result.push_str("\n\n---\n\n");
                }
                result.push_str(&md);
            }
        }
    }

    Ok(result)
}

/// Detect source format from file extension
fn detect_format(input: &str) -> Result<&str, String> {
    let lower = input.to_lowercase();
    if lower.ends_with(".docx") {
        Ok("docx")
    } else if lower.ends_with(".html") || lower.ends_with(".htm") {
        Ok("html")
    } else if lower.ends_with(".epub") {
        Ok("epub")
    } else if lower.ends_with(".pdf") {
        Ok("pdf")
    } else {
        Err(format!("不支持的导入格式: {}", input))
    }
}

/// Generate suggested output filename (stem + .md)
fn suggested_name(input: &str) -> String {
    let path = Path::new(input);
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "导入文档".into());
    format!("{}.md", stem)
}

/// Main entry: convert a file to Markdown
///
/// Returns (markdown_content, suggested_filename)
pub fn convert_file(input: &str) -> Result<(String, String), String> {
    let format = detect_format(input)?;

    let md = if pandoc_available() {
        convert_via_pandoc(input, format)?
    } else {
        match format {
            "html" => html_to_md_fallback(input)?,
            "docx" => docx_to_md_fallback(input)?,
            "pdf" => pdf_to_md_fallback(input)?,
            "epub" => epub_to_md_fallback(input)?,
            _ => unreachable!(),
        }
    };

    Ok((md, suggested_name(input)))
}

#[tauri::command]
pub fn check_pandoc() -> bool {
    pandoc_available()
}

#[tauri::command]
pub async fn import_file(source_path: String) -> Result<serde_json::Value, String> {
    // 与其它文件命令保持一致的路径校验（拒绝 `..` 遍历和空字节）
    crate::sanitize_path(&source_path)?;
    tauri::async_runtime::spawn_blocking(move || {
        let (content, suggested_name) = convert_file(&source_path)?;
        Ok(serde_json::json!({
            "content": content,
            "suggestedName": suggested_name
        }))
    })
    .await
    .map_err(|e| format!("导入任务失败: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_format_recognizes_known_extensions() {
        assert_eq!(detect_format("a.docx").unwrap(), "docx");
        assert_eq!(detect_format("a.html").unwrap(), "html");
        assert_eq!(detect_format("a.htm").unwrap(), "html");
        assert_eq!(detect_format("a.epub").unwrap(), "epub");
        assert_eq!(detect_format("a.pdf").unwrap(), "pdf");
    }

    #[test]
    fn detect_format_is_case_insensitive() {
        assert_eq!(detect_format("REPORT.DOCX").unwrap(), "docx");
        assert_eq!(detect_format("Page.HTML").unwrap(), "html");
    }

    #[test]
    fn detect_format_rejects_unknown() {
        assert!(detect_format("notes.txt").is_err());
        assert!(detect_format("no_extension").is_err());
        assert!(detect_format("archive.zip").is_err());
    }

    #[test]
    fn suggested_name_uses_stem_with_md_extension() {
        assert_eq!(suggested_name("report.docx"), "report.md");
        assert_eq!(suggested_name("/tmp/dir/我的文档.epub"), "我的文档.md");
    }

    #[test]
    fn suggested_name_handles_no_stem() {
        // 无文件名部分时回退到默认名
        assert_eq!(suggested_name("/"), "导入文档.md");
    }

    #[test]
    fn pdf_fallback_without_pandoc_returns_error() {
        assert!(pdf_to_md_fallback("x.pdf").is_err());
    }

    #[tokio::test]
    async fn import_file_rejects_path_traversal() {
        let err = import_file("../../etc/passwd.docx".to_string()).await.unwrap_err();
        assert!(err.contains(".."));
    }

    #[tokio::test]
    async fn import_file_rejects_null_byte() {
        assert!(import_file("evil\0.docx".to_string()).await.is_err());
    }

    #[tokio::test]
    async fn import_file_rejects_unsupported_format() {
        // 路径合法但扩展名不支持：应在读取文件前就报错
        let err = import_file("notes.txt".to_string()).await.unwrap_err();
        assert!(err.contains("不支持的导入格式"));
    }
}
