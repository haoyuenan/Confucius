use pulldown_cmark::{Event, HeadingLevel, Options, Parser, Tag, TagEnd};
use regex::Regex;
use std::sync::OnceLock;

fn is_cjk(c: char) -> bool {
    matches!(c,
        '\u{4e00}'..='\u{9fff}' |
        '\u{3400}'..='\u{4dbf}' |
        '\u{20000}'..='\u{2a6df}'
    )
}

pub fn slugify(text: &str) -> String {
    text.to_lowercase()
        .trim()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join("-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || is_cjk(*c))
        .collect()
}

fn wikilink_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]").unwrap())
}

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn process_wikilinks(text: &str) -> String {
    wikilink_re()
        .replace_all(text, |caps: &regex::Captures| {
            let title = &caps[1];
            let display = caps.get(2).map(|m| m.as_str()).unwrap_or(title);
            let escaped_title = escape_html(title);
            let escaped_display = escape_html(display);
            format!(
                "<wiki-link data-title=\"{}\">{}</wiki-link>",
                escaped_title, escaped_display
            )
        })
        .to_string()
}

fn heading_num(level: HeadingLevel) -> u8 {
    match level {
        HeadingLevel::H1 => 1,
        HeadingLevel::H2 => 2,
        HeadingLevel::H3 => 3,
        HeadingLevel::H4 => 4,
        HeadingLevel::H5 => 5,
        HeadingLevel::H6 => 6,
    }
}

pub struct MarkdownRenderer<'a> {
    output: String,
    highlight: &'a dyn Fn(&str, &str) -> String,
    heading_raw_text: String,
    heading_level: HeadingLevel,
    in_heading: bool,
    in_code_block: bool,
    code_block_lang: String,
    code_block_content: String,
    list_kind_stack: Vec<bool>, // true = ordered, false = unordered
}

impl<'a> MarkdownRenderer<'a> {
    pub fn new(highlight: &'a dyn Fn(&str, &str) -> String) -> Self {
        Self {
            output: String::with_capacity(4096),
            highlight,
            heading_raw_text: String::new(),
            heading_level: HeadingLevel::H1,
            in_heading: false,
            in_code_block: false,
            code_block_lang: String::new(),
            code_block_content: String::new(),
            list_kind_stack: Vec::new(),
        }
    }

    pub fn render(&mut self, text: &str) -> &str {
        // Pre-process wikilinks before pulldown-cmark: [[target|display]] → <wiki-link>
        // This prevents pulldown-cmark from consuming the [[ brackets as link syntax
        let preprocessed = process_wikilinks(text);
        // Also escape any remaining unprocessed [ that could confuse the parser
        // (the wikilink_re only handles the [[...]] pattern)

        let mut options = Options::empty();
        options.insert(Options::ENABLE_TABLES);
        options.insert(Options::ENABLE_FOOTNOTES);
        options.insert(Options::ENABLE_STRIKETHROUGH);
        options.insert(Options::ENABLE_TASKLISTS);
        options.insert(Options::ENABLE_HEADING_ATTRIBUTES);
        options.insert(Options::ENABLE_DEFINITION_LIST);
        options.insert(Options::ENABLE_SMART_PUNCTUATION);
        options.insert(Options::ENABLE_MATH);

        let parser = Parser::new_ext(&preprocessed, options);

        for event in parser {
            match event {
                Event::Start(tag) => self.handle_start(tag),
                Event::End(tag) => self.handle_end(tag),
                Event::Text(t) => self.handle_text(&t),
                Event::Code(t) => {
                    self.output.push_str("<code>");
                    self.output.push_str(&escape_html(&t));
                    self.output.push_str("</code>");
                }
                Event::Html(t) => {
                    self.output.push_str(&t);
                }
                Event::InlineHtml(t) => {
                    self.output.push_str(&t);
                }
                Event::SoftBreak => {
                    self.output.push('\n');
                }
                Event::HardBreak => {
                    self.output.push_str("<br />\n");
                }
                Event::Rule => {
                    self.output.push_str("<hr />\n");
                }
                Event::FootnoteReference(t) => {
                    self.output.push_str("<sup class=\"footnote-ref\">");
                    self.output.push_str(&escape_html(&t));
                    self.output.push_str("</sup>");
                }
                Event::TaskListMarker(checked) => {
                    let check = if checked { "checked=\"\"" } else { "" };
                    self.output.push_str(&format!(
                        "<input type=\"checkbox\" {} disabled=\"\" /> ",
                        check
                    ));
                }
                Event::InlineMath(t) => {
                    let escaped = escape_html(&t);
                    self.output
                        .push_str(&format!(
                            "<span class=\"katex-inline\" data-tex=\"{}\"></span>",
                            escaped
                        ));
                }
                Event::DisplayMath(t) => {
                    let escaped = escape_html(&t);
                    self.output
                        .push_str(&format!(
                            "<span class=\"katex-block\" data-tex=\"{}\"></span>",
                            escaped
                        ));
                }
            }
        }

        &self.output
    }

    fn handle_start(&mut self, tag: Tag) {
        match tag {
            Tag::Paragraph => {
                self.output.push_str("<p>");
            }
            Tag::Heading {
                level,
                id: _,
                classes: _,
                attrs: _,
            } => {
                self.in_heading = true;
                self.heading_level = level;
                self.heading_raw_text.clear();
                let n = heading_num(level);
                self.output.push_str(&format!("<h{}>", n));
            }
            Tag::BlockQuote(_) => {
                self.output.push_str("<blockquote>\n");
            }
            Tag::CodeBlock(kind) => {
                self.in_code_block = true;
                self.code_block_lang = match kind {
                    pulldown_cmark::CodeBlockKind::Fenced(lang) => lang.to_string(),
                    pulldown_cmark::CodeBlockKind::Indented => String::new(),
                };
                self.code_block_content.clear();
            }
            Tag::List(start) => {
                let is_ordered = start.is_some(); // Some(n) = ordered, None = unordered
                self.list_kind_stack.push(is_ordered);
                if is_ordered {
                    self.output.push_str("<ol>\n");
                } else {
                    self.output.push_str("<ul>\n");
                }
            }
            Tag::Item => {
                self.output.push_str("<li>");
            }
            Tag::Table(_) => {
                self.output.push_str("<table>\n");
            }
            Tag::TableHead => {
                self.output.push_str("<thead>\n<tr>");
            }
            Tag::TableRow => {
                self.output.push_str("<tr>");
            }
            Tag::TableCell => {
                self.output.push_str("<td>");
            }
            Tag::Emphasis => {
                self.output.push_str("<em>");
            }
            Tag::Strong => {
                self.output.push_str("<strong>");
            }
            Tag::Strikethrough => {
                self.output.push_str("<del>");
            }
            Tag::Link {
                link_type: _,
                dest_url,
                title,
                id: _,
            } => {
                let url = escape_html(&dest_url);
                self.output.push_str(&format!("<a href=\"{}\"", url));
                if !title.is_empty() {
                    let t = escape_html(&title);
                    self.output.push_str(&format!(" title=\"{}\"", t));
                }
                self.output.push('>');
            }
            Tag::Image {
                link_type: _,
                dest_url,
                title,
                id: _,
            } => {
                let url = escape_html(&dest_url);
                self.output.push_str(&format!("<img src=\"{}\"", url));
                if !title.is_empty() {
                    let t = escape_html(&title);
                    self.output.push_str(&format!(" title=\"{}\"", t));
                }
                self.output.push_str(" alt=\"");
            }
            Tag::FootnoteDefinition(t) => {
                self.output
                    .push_str(&format!("<div class=\"footnote-definition\" id=\"{}\">\n", t));
            }
            Tag::MetadataBlock(_) => {}
            _ => {} // catch-all for other tags (HtmlBlock, DefinitionList, Superscript, etc.)
        }
    }

    fn handle_end(&mut self, tag: TagEnd) {
        match tag {
            TagEnd::Paragraph => {
                self.output.push_str("</p>\n");
            }
            TagEnd::Heading(_) => {
                self.in_heading = false;
                let n = heading_num(self.heading_level);
                let slug = slugify(&self.heading_raw_text);
                let open_tag = format!("<h{}>", n);
                let open_with_id = format!("<h{} id=\"{}\">", n, slug);
                if let Some(pos) = self.output.rfind(&open_tag) {
                    self.output
                        .replace_range(pos..pos + open_tag.len(), &open_with_id);
                }
                self.output.push_str(&format!("</h{}>\n", n));
            }
            TagEnd::BlockQuote(_) => {
                self.output.push_str("</blockquote>\n");
            }
            TagEnd::CodeBlock => {
                self.in_code_block = false;
                let highlighted =
                    (self.highlight)(&self.code_block_content, &self.code_block_lang);
                self.output.push_str(&highlighted);
                self.output.push('\n');
            }
            TagEnd::List(_tight) => {
                if let Some(is_ordered) = self.list_kind_stack.pop() {
                    if is_ordered {
                        self.output.push_str("</ol>\n");
                    } else {
                        self.output.push_str("</ul>\n");
                    }
                }
            }
            TagEnd::Item => {
                self.output.push_str("</li>\n");
            }
            TagEnd::Table => {
                self.output.push_str("</table>\n");
            }
            TagEnd::TableHead => {
                self.output.push_str("</tr>\n</thead>\n");
            }
            TagEnd::TableRow => {
                self.output.push_str("</tr>\n");
            }
            TagEnd::TableCell => {
                self.output.push_str("</td>");
            }
            TagEnd::Emphasis => {
                self.output.push_str("</em>");
            }
            TagEnd::Strong => {
                self.output.push_str("</strong>");
            }
            TagEnd::Strikethrough => {
                self.output.push_str("</del>");
            }
            TagEnd::Link => {
                self.output.push_str("</a>");
            }
            TagEnd::Image => {
                self.output.push_str("\" />");
            }
            TagEnd::FootnoteDefinition => {
                self.output.push_str("</div>\n");
            }
            TagEnd::MetadataBlock(_) => {}
            _ => {} // catch-all for other TagEnd variants
        }
    }

    fn handle_text(&mut self, text: &str) {
        if self.in_code_block {
            self.code_block_content.push_str(text);
            return;
        }

        if self.in_heading {
            self.heading_raw_text.push_str(text);
        }

        // Wikilinks are already preprocessed in render() before pulldown-cmark parsing
        // so text events no longer contain [[...]] patterns
        self.output.push_str(text);
    }
}

pub fn render_markdown(text: &str, highlight: &dyn Fn(&str, &str) -> String) -> String {
    let mut renderer = MarkdownRenderer::new(highlight);
    renderer.render(text);
    renderer.output.clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn noop_highlight(code: &str, _lang: &str) -> String {
        format!(
            "<pre class=\"code-block\"><code>{}</code></pre>",
            escape_html(code)
        )
    }

    #[test]
    fn test_paragraph() {
        let html = render_markdown("Hello world", &noop_highlight);
        assert!(html.contains("<p>Hello world</p>"));
    }

    #[test]
    fn test_heading_with_slug() {
        let html = render_markdown("# Hello World", &noop_highlight);
        assert!(html.contains("id=\"hello-world\""));
        assert!(html.contains("<h1"));
        assert!(html.contains("</h1>"));
    }

    #[test]
    fn test_heading_cjk() {
        let html = render_markdown("# 你好世界", &noop_highlight);
        assert!(html.contains("id=\"你好世界\""));
    }

    #[test]
    fn test_wikilink_with_pipe() {
        let html = render_markdown("[[target page|显示名]]", &noop_highlight);
        assert!(html.contains("<wiki-link data-title=\"target page\">显示名</wiki-link>"));
    }

    #[test]
    fn test_wikilink_simple() {
        let html = render_markdown("[[note-title]]", &noop_highlight);
        assert!(html.contains("<wiki-link data-title=\"note-title\">note-title</wiki-link>"));
    }

    #[test]
    fn test_bold_italic() {
        let html = render_markdown("**bold** and *italic*", &noop_highlight);
        assert!(html.contains("<strong>bold</strong>"));
        assert!(html.contains("<em>italic</em>"));
    }

    #[test]
    fn test_code_block_no_lang() {
        let html = render_markdown("```\ncode\n```", &noop_highlight);
        assert!(html.contains("<pre class=\"code-block\">"));
        assert!(html.contains("<code>"));
    }

    #[test]
    fn test_unordered_list() {
        let html = render_markdown("- item1\n- item2", &noop_highlight);
        assert!(html.contains("<ul>"));
        assert!(html.contains("<li>item1</li>"));
    }

    #[test]
    fn test_link() {
        let html = render_markdown("[text](https://example.com)", &noop_highlight);
        assert!(html.contains("<a href=\"https://example.com\">text</a>"));
    }

    #[test]
    fn test_image() {
        let html = render_markdown("![alt](img.png)", &noop_highlight);
        assert!(html.contains("<img src=\"img.png\" alt=\"alt\""));
    }

    #[test]
    fn test_blockquote() {
        let html = render_markdown("> quote", &noop_highlight);
        assert!(html.contains("<blockquote>"));
    }

    #[test]
    fn test_inline_code() {
        let html = render_markdown("Use `code` here", &noop_highlight);
        assert!(html.contains("<code>code</code>"));
    }

    #[test]
    fn test_horizontal_rule() {
        let html = render_markdown("---\n", &noop_highlight);
        assert!(html.contains("<hr />"));
    }

    #[test]
    fn test_strikethrough() {
        let html = render_markdown("~~strike~~", &noop_highlight);
        assert!(html.contains("<del>strike</del>"));
    }

    #[test]
    fn test_inline_math() {
        let html = render_markdown("$E=mc^2$", &noop_highlight);
        assert!(html.contains("katex-inline"));
        assert!(html.contains("data-tex"));
    }

    #[test]
    fn test_display_math() {
        let html = render_markdown("$$\\sum_{i=1}^n i$$", &noop_highlight);
        assert!(html.contains("katex-block"));
        assert!(html.contains("data-tex"));
    }

    #[test]
    fn test_slugify() {
        assert_eq!(slugify("Hello World"), "hello-world");
        assert_eq!(slugify("  Spaces  "), "spaces");
        assert_eq!(slugify("Hello-World"), "hello-world");
    }

    #[test]
    fn test_task_list() {
        let html = render_markdown("- [x] done\n- [ ] todo", &noop_highlight);
        assert!(html.contains("checked=\"\""));
        assert!(html.contains("disabled=\"\""));
    }

    #[test]
    fn test_table() {
        let md = "| a | b |\n|---|---|\n| 1 | 2 |";
        let html = render_markdown(md, &noop_highlight);
        assert!(html.contains("<table>"));
        assert!(html.contains("<td>a</td>"));
    }
}
