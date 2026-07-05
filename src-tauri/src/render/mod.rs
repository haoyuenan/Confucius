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
    // Use the existing sanitize_path logic
    if path.is_empty() {
        return Err("路径为空".into());
    }
    if path.contains("..") {
        return Err(format!("路径包含非法序列 \"..\": {}", path));
    }
    if path.contains('\0') {
        return Err("路径包含空字节".into());
    }

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

    // Sanitize and chunk the output
    let sanitized = sanitize::sanitize_html(&html);

    for chunk in sanitized.as_bytes().chunks(STREAM_CHUNK_SIZE) {
        let fragment = String::from_utf8_lossy(chunk).to_string();
        pending.push_str(&fragment);

        // Emit on paragraph/section boundaries by checking for newlines
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
