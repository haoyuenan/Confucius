pub mod markdown;
pub mod sanitize;
pub mod syntax;

/// Synchronous markdown → HTML rendering.
/// Accepts raw markdown text, returns sanitized HTML.
///
/// Note: the frontend renders markdown via its own JS pipeline; this command is
/// kept as a reusable Rust-side renderer (e.g. for a future CLI / headless use).
#[tauri::command]
pub fn render_markdown(text: String) -> Result<String, String> {
    let html = markdown::render_markdown(&text, &|code, lang| syntax::highlight_code(code, lang));
    let sanitized = sanitize::sanitize_html(&html);
    Ok(sanitized)
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
