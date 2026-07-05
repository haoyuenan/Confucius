use syntect::html::highlighted_html_for_string;
use syntect::highlighting::ThemeSet;
use syntect::parsing::SyntaxSet;
use std::sync::OnceLock;

fn syntax_set() -> &'static SyntaxSet {
    static SS: OnceLock<SyntaxSet> = OnceLock::new();
    SS.get_or_init(|| SyntaxSet::load_defaults_newlines())
}

fn theme_set() -> &'static ThemeSet {
    static TS: OnceLock<ThemeSet> = OnceLock::new();
    TS.get_or_init(ThemeSet::load_defaults)
}

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Highlight code with syntect, returning a `<pre><code>` block.
/// Falls back to plain text if language is unknown.
pub fn highlight_code(code: &str, lang: &str) -> String {
    let ss = syntax_set();
    let ts = theme_set();

    let syntax = if lang.is_empty() {
        ss.find_syntax_plain_text()
    } else {
        ss.find_syntax_by_token(lang)
            .unwrap_or_else(|| ss.find_syntax_plain_text())
    };

    // Use base16-ocean.dark theme for consistent look
    let theme = &ts.themes["base16-ocean.dark"];

    match highlighted_html_for_string(code, ss, syntax, theme) {
        Ok(highlighted) => {
            let lang_label = if !lang.is_empty() {
                format!("<span class=\"lang-label\">{}</span>", escape_html(lang))
            } else {
                String::new()
            };
            format!("{} {}", highlighted.trim(), lang_label)
        }
        Err(_) => {
            let escaped = escape_html(code);
            let lang_label = if !lang.is_empty() {
                format!("<span class=\"lang-label\">{}</span>", escape_html(lang))
            } else {
                String::new()
            };
            format!(
                "<pre class=\"code-block\"><code class=\"hljs\">{}</code>{}</pre>",
                escaped, lang_label
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_highlight_rust() {
        let result = highlight_code("fn main() {}", "rust");
        assert!(result.contains("fn"));
        assert!(result.contains("main"));
    }

    #[test]
    fn test_highlight_unknown_lang() {
        let result = highlight_code("plain text", "doesnotexistlang");
        assert!(result.contains("plain text"));
    }

    #[test]
    fn test_highlight_no_lang() {
        let result = highlight_code("plain text", "");
        assert!(result.contains("plain text"));
        assert!(result.contains("<pre"));
    }

    #[test]
    fn test_highlight_javascript() {
        let result = highlight_code("const x = 1;", "javascript");
        assert!(result.contains("const"));
    }

    #[test]
    fn test_highlight_python() {
        let result = highlight_code("def hello(): pass", "python");
        assert!(result.contains("def"));
    }
}
