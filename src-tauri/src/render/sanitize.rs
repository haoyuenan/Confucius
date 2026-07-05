use ammonia::Builder;
use std::collections::{HashMap, HashSet};

/// Sanitize HTML to prevent XSS, matching the DOMPurify config from the frontend.
/// Allows markdown-rendered elements, SVG, and safe attributes.
pub fn sanitize_html(html: &str) -> String {
    let tags: HashSet<&str> = HashSet::from([
        "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "ul", "ol", "li", "pre", "code",
        "blockquote", "table", "thead", "tbody", "tr", "th", "td", "a", "img", "em", "strong",
        "del", "ins", "sub", "sup", "span", "div", "svg", "path", "g", "defs", "text", "tspan",
        "rect", "circle", "line", "polyline", "polygon", "input", "wiki-link", "sup",
    ]);

    let mut tag_attrs: HashMap<&str, HashSet<&str>> = HashMap::new();

    tag_attrs.insert("a", HashSet::from(["href", "title", "target"]));
    tag_attrs.insert("img", HashSet::from(["src", "alt", "title", "width", "height"]));
    tag_attrs.insert("span", HashSet::from(["class", "data-tex", "id"]));
    tag_attrs.insert("div", HashSet::from(["class", "id"]));
    tag_attrs.insert("pre", HashSet::from(["class"]));
    tag_attrs.insert("code", HashSet::from(["class"]));
    tag_attrs.insert("td", HashSet::from(["class"]));
    tag_attrs.insert("th", HashSet::from(["class"]));
    tag_attrs.insert("wiki-link", HashSet::from(["data-title"]));
    tag_attrs.insert("sup", HashSet::from(["class"]));
    tag_attrs.insert("input", HashSet::from(["type", "checked", "disabled"]));
    tag_attrs.insert(
        "svg",
        HashSet::from(["xmlns", "viewBox", "width", "height", "class"]),
    );
    tag_attrs.insert(
        "path",
        HashSet::from(["d", "fill", "stroke", "stroke-width"]),
    );
    tag_attrs.insert("g", HashSet::from(["fill", "stroke"]));
    tag_attrs.insert(
        "rect",
        HashSet::from(["x", "y", "width", "height", "rx", "ry", "fill"]),
    );
    tag_attrs.insert("circle", HashSet::from(["cx", "cy", "r", "fill"]));
    tag_attrs.insert(
        "text",
        HashSet::from(["x", "y", "fill", "font-size"]),
    );
    tag_attrs.insert("tspan", HashSet::from(["x", "dy", "fill"]));
    tag_attrs.insert(
        "line",
        HashSet::from(["x1", "y1", "x2", "y2", "stroke", "stroke-width"]),
    );
    tag_attrs.insert(
        "polyline",
        HashSet::from(["points", "fill", "stroke"]),
    );
    tag_attrs.insert(
        "polygon",
        HashSet::from(["points", "fill", "stroke"]),
    );

    Builder::default()
        .tags(tags)
        .tag_attributes(tag_attrs)
        .link_rel(Some("noopener noreferrer"))
        .clean(html)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allows_basic_html() {
        let result = sanitize_html("<p>Hello</p>");
        assert_eq!(result, "<p>Hello</p>");
    }

    #[test]
    fn test_removes_script_tags() {
        let result = sanitize_html("<script>alert('xss')</script><p>safe</p>");
        assert!(!result.contains("<script"));
        assert!(result.contains("<p>safe</p>"));
    }

    #[test]
    fn test_removes_onclick() {
        let result = sanitize_html("<p onclick=\"alert(1)\">text</p>");
        assert_eq!(result, "<p>text</p>");
    }

    #[test]
    fn test_allows_wiki_link() {
        let result = sanitize_html("<wiki-link data-title=\"page\">text</wiki-link>");
        assert!(result.contains("<wiki-link"));
        assert!(result.contains("data-title"));
    }

    #[test]
    fn test_allows_katex_span() {
        let result =
            sanitize_html("<span class=\"katex-inline\" data-tex=\"E=mc^2\"></span>");
        assert!(result.contains("data-tex"));
    }

    #[test]
    fn test_removes_javascript_href() {
        let result = sanitize_html("<a href=\"javascript:alert('xss')\">click</a>");
        assert!(!result.contains("javascript"));
    }

    #[test]
    fn test_keeps_normal_link() {
        let result = sanitize_html("<a href=\"https://example.com\">click</a>");
        assert!(result.contains("https://example.com"));
    }
}
