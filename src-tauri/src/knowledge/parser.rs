use regex::Regex;
use std::sync::OnceLock;

// 正则一次性编译缓存（全量扫描时每文件复用，避免每文件重复编译）
fn code_block_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"```[\s\S]*?```").unwrap())
}

fn inline_code_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"`[^`]*`").unwrap())
}

fn wikilink_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]").unwrap())
}

fn tag_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?:^|\s)#([\w\u{4e00}-\u{9fff}/-]+)").unwrap())
}

fn digits_only_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^\d+$").unwrap())
}

fn frontmatter_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^---\n([\s\S]*?)\n---").unwrap())
}

fn frontmatter_tags_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r##"(?m)^tags:\s*\[(.+?)\]"##).unwrap())
}

fn h1_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^#\s+(.+)").unwrap())
}


pub fn parse_wikilinks(content: &str) -> Vec<String> {
    let cleaned = code_block_re().replace_all(content, "");
    let cleaned = inline_code_re().replace_all(&cleaned, "");

    let mut links = Vec::new();
    for cap in wikilink_re().captures_iter(&cleaned) {
        let link = cap[1].trim().to_string();
        if !links.contains(&link) {
            links.push(link);
        }
    }
    links
}

pub fn parse_tags(content: &str) -> Vec<String> {
    let cleaned = code_block_re().replace_all(content, "");
    let cleaned = inline_code_re().replace_all(&cleaned, "");

    let mut tags: Vec<String> = Vec::new();
    for cap in tag_re().captures_iter(&cleaned) {
        let tag = cap[1].trim().to_string();
        if !tag.is_empty() && !digits_only_re().is_match(&tag) {
            if !tags.contains(&tag) {
                tags.push(tag);
            }
        }
    }

    // Frontmatter tags: line matching `tags: [...]`
    if let Some(fm_match) = frontmatter_re().captures(content) {
        let fm = &fm_match[1];
        if let Some(tag_line) = frontmatter_tags_re().captures(fm) {
            for t in tag_line[1].split(',') {
                let tag = t.trim().trim_matches('"').trim_matches('\'').to_string();
                if !tag.is_empty() && !tags.contains(&tag) {
                    tags.push(tag);
                }
            }
        }
    }

    tags
}

/// Returns (title, created) from YAML frontmatter
pub fn parse_frontmatter(content: &str) -> (Option<String>, Option<String>) {
    let (mut title, mut created) = (None, None);
    if let Some(caps) = frontmatter_re().captures(content) {
        let fm = &caps[1];
        for line in fm.lines() {
            if let Some((key, value)) = line.split_once(':') {
                let v = value.trim().trim_matches('"').trim_matches('\'');
                match key.trim() {
                    "title" => title = Some(v.to_string()),
                    "created" => created = Some(v.to_string()),
                    _ => {}
                }
            }
        }
    }
    (title, created)
}

/// Extract document title: frontmatter title > first h1 > filename (without ext)
pub fn extract_title(file_path: &str, content: &str) -> String {
    if let (Some(title), _) = parse_frontmatter(content) {
        if !title.is_empty() {
            return title;
        }
    }
    if let Some(caps) = h1_re().captures(content) {
        return caps[1].trim().to_string();
    }
    let path = file_path.replace('\\', "/");
    let name = path.split('/').last().unwrap_or(file_path);
    let name = name.strip_suffix(".md").unwrap_or(name);
    let name = name.strip_suffix(".markdown").unwrap_or(name);
    name.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── wikilinks ──

    #[test]
    fn parse_simple_wikilink() {
        let result = parse_wikilinks("[[项目笔记]]");
        assert_eq!(result, vec!["项目笔记"]);
    }

    #[test]
    fn parse_wikilink_with_alias() {
        let result = parse_wikilinks("[[项目笔记|我的项目]]");
        assert_eq!(result, vec!["项目笔记"]);
    }

    #[test]
    fn parse_multiple_links() {
        let result = parse_wikilinks("[[A]] 和 [[B]] [[C]]");
        assert_eq!(result.len(), 3);
        assert!(result.contains(&"A".to_string()));
        assert!(result.contains(&"B".to_string()));
        assert!(result.contains(&"C".to_string()));
    }

    #[test]
    fn ignore_links_in_code_blocks() {
        let result = parse_wikilinks("```\n[[不是链接]]\n```\n[[是链接]]");
        assert_eq!(result, vec!["是链接"]);
    }

    #[test]
    fn ignore_links_in_inline_code() {
        let result = parse_wikilinks("`[[不是]]` [[是链接]]");
        assert_eq!(result, vec!["是链接"]);
    }

    #[test]
    fn deduplicate_links() {
        let result = parse_wikilinks("[[A]] [[A]]");
        assert_eq!(result, vec!["A"]);
    }

    // ── tags ──

    #[test]
    fn parse_inline_tags() {
        let result = parse_tags("这是一段文字 #标签1 和 #标签2");
        assert!(result.contains(&"标签1".to_string()));
        assert!(result.contains(&"标签2".to_string()));
    }

    #[test]
    fn parse_frontmatter_tags() {
        let content = "---\ntitle: 测试\ntags: [日记, 项目]\n---\n\n# 标题";
        let result = parse_tags(content);
        assert!(result.contains(&"日记".to_string()));
        assert!(result.contains(&"项目".to_string()));
    }

    #[test]
    fn ignore_pure_number_tags() {
        let result = parse_tags("#2023 不是标签，但是 #proj 是");
        assert!(!result.contains(&"2023".to_string()));
        assert!(result.contains(&"proj".to_string()));
    }

    #[test]
    fn ignore_tags_in_code_blocks() {
        let result = parse_tags("```\n#不是标签\n```\n#是标签");
        assert!(result.contains(&"是标签".to_string()));
        assert!(!result.contains(&"不是标签".to_string()));
    }

    #[test]
    fn chinese_tags() {
        let result = parse_tags("今天学习了 #论语 #道德经");
        assert!(result.contains(&"论语".to_string()));
        assert!(result.contains(&"道德经".to_string()));
    }

    #[test]
    fn tag_with_slash() {
        let result = parse_tags("参考 #语言/英语 笔记");
        assert!(result.contains(&"语言/英语".to_string()));
    }

    // ── frontmatter ──

    #[test]
    fn parse_frontmatter_title_and_created() {
        let content = "---\ntitle: 我的笔记\ncreated: 2026-01-01\ntags: [日记]\n---\n\n# 正文";
        let (title, created) = parse_frontmatter(content);
        assert_eq!(title, Some("我的笔记".to_string()));
        assert_eq!(created, Some("2026-01-01".to_string()));
    }

    #[test]
    fn frontmatter_with_quoted_values() {
        let content = "---\ntitle: \"带引号的标题\"\ncreated: '2026-06-19'\n---\n\n";
        let (title, created) = parse_frontmatter(content);
        assert_eq!(title, Some("带引号的标题".to_string()));
        assert_eq!(created, Some("2026-06-19".to_string()));
    }

    #[test]
    fn no_frontmatter() {
        let (title, created) = parse_frontmatter("# 只有标题\n\n正文内容");
        assert_eq!(title, None);
        assert_eq!(created, None);
    }

    // ── extract_title ──

    #[test]
    fn title_from_frontmatter() {
        let t = extract_title("/notes/test.md", "---\ntitle: 前端页面\n---\n\n# H1标题\n");
        assert_eq!(t, "前端页面");
    }

    #[test]
    fn title_from_h1() {
        let t = extract_title("/notes/test.md", "# H1标题\n\n正文");
        assert_eq!(t, "H1标题");
    }

    #[test]
    fn title_from_filename() {
        let t = extract_title("/notes/我的笔记.md", "没有标题的内容");
        assert_eq!(t, "我的笔记");
    }

    #[test]
    fn title_from_markdown_ext() {
        let t = extract_title("/notes/readme.markdown", "# Title");
        assert_eq!(t, "Title");
    }

    #[test]
    fn title_from_filename_no_ext() {
        let t = extract_title("/notes/readme", "content");
        assert_eq!(t, "readme");
    }
}
