pub mod markdown;
pub mod sanitize;
pub mod syntax;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

const STREAM_CHUNK_SIZE: usize = 4096;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAndRenderResult {
    pub text: String,
    pub html: String,
}

/// Synchronous markdown → HTML rendering.
/// Accepts raw markdown text, returns sanitized HTML.
#[tauri::command]
pub fn render_markdown(text: String) -> Result<String, String> {
    let html = markdown::render_markdown(&text, &|code, lang| syntax::highlight_code(code, lang));
    let sanitized = sanitize::sanitize_html(&html);
    Ok(sanitized)
}

/// Read file + render markdown in one IPC call.
/// Returns both the raw text (for CM6 editor) and rendered HTML (for preview).
#[tauri::command]
pub fn open_and_render(path: String) -> Result<OpenAndRenderResult, String> {
    // 复用统一的路径校验逻辑，避免与 lib.rs::sanitize_path 出现两套不同步的实现
    crate::sanitize_path(&path)?;

    let text = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取文件失败: {}", e))?;

    let html = markdown::render_markdown(&text, &|code, lang| syntax::highlight_code(code, lang));
    let sanitized = sanitize::sanitize_html(&html);

    Ok(OpenAndRenderResult {
        text,
        html: sanitized,
    })
}

/// Streaming markdown rendering for large files.
/// Emits `renderer:chunk` events with HTML fragments, then `renderer:done` when finished.
#[tauri::command]
pub fn render_markdown_stream(app: AppHandle, text: String) -> Result<(), String> {
    let mut pending = String::new();

    // Render in sections and emit chunks
    // We'll use pulldown-cmark's event stream to accumulate HTML in chunks
    let html = markdown::render_markdown(&text, &|code, lang| syntax::highlight_code(code, lang));

    // Sanitize and chunk the output.
    // IMPORTANT: chunk by `char` boundaries, not raw bytes — slicing `as_bytes()`
    // at a fixed byte offset can split a multi-byte UTF-8 character (e.g. any CJK
    // character) in half. `String::from_utf8_lossy` would then replace both the
    // truncated tail and the orphaned head with U+FFFD ("�"), permanently
    // corrupting the text even after all chunks are concatenated back together.
    let sanitized = sanitize::sanitize_html(&html);

    for ch in sanitized.chars() {
        pending.push(ch);

        if pending.len() >= STREAM_CHUNK_SIZE {
            app.emit("renderer:chunk", &pending)
                .map_err(|e| format!("发送渲染块失败: {}", e))?;
            pending.clear();
        }
    }

    // Emit remaining content
    if !pending.is_empty() {
        app.emit("renderer:chunk", &pending)
            .map_err(|e| format!("发送渲染块失败: {}", e))?;
    }

    app.emit("renderer:done", "")
        .map_err(|e| format!("发送渲染完成信号失败: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render_markdown_basic() {
        let result = render_markdown("Hello **world**".to_string());
        assert!(result.is_ok());
        let html = result.unwrap();
        assert!(html.contains("<p"));
        assert!(html.contains("<strong>world</strong>"));
    }

    #[test]
    fn test_render_markdown_script_removed() {
        let result = render_markdown("<script>alert(1)</script>".to_string());
        assert!(result.is_ok());
        let html = result.unwrap();
        assert!(!html.contains("<script"));
    }

    #[test]
    fn test_render_markdown_empty() {
        let result = render_markdown(String::new());
        assert!(result.is_ok());
    }
}
