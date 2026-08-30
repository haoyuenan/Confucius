use crate::search::schema::*;
use tantivy::collector::TopDocs;
use tantivy::directory::MmapDirectory;
use tantivy::query::QueryParser;
use tantivy::Index;

/// 在源文件内容中定位任意一个查询词出现的位置，生成 snippet。
///
/// 返回 `(行号, 行内容, 行内匹配起, 行内匹配终)`。
/// 匹配大小写不敏感；字节区间语义与 regex 路径的 `m.start()/m.end()` 一致
/// （前置 highlightMatch 用 `text.slice(start, end)`，对 ASCII 字节=码元）。
fn locate_match(content: &str, query: &str) -> Option<(u32, String, u32, u32)> {
    if content.is_empty() || query.trim().is_empty() {
        return None;
    }

    // 短语优先：整句字面量匹配
    let whole = query.trim().to_ascii_lowercase();
    if !whole.is_empty() {
        for (i, line) in content.lines().enumerate() {
            if let Some(pos) = find_ci(line, &whole) {
                return Some((
                    (i + 1) as u32,
                    line.to_string(),
                    pos as u32,
                    (pos + whole.len()) as u32,
                ));
            }
        }
    }

    // 逐词匹配（Tantivy 按空白拆词，此处对齐）
    for tok in query
        .split_whitespace()
        .map(|w| w.to_ascii_lowercase())
        .filter(|w| !w.is_empty())
    {
        for (i, line) in content.lines().enumerate() {
            if let Some(pos) = find_ci(line, &tok) {
                return Some((
                    (i + 1) as u32,
                    line.to_string(),
                    pos as u32,
                    (pos + tok.len()) as u32,
                ));
            }
        }
    }

    None
}

/// 大小写不敏感的字节级子串查找，返回命中处的字节偏移（对齐原始行）。
/// 对 ASCII 做 `to_ascii_lowercase` 比较；非 ASCII 字节逐字节比较（CJK 等）。
fn find_ci(haystack: &str, needle: &str) -> Option<usize> {
    let hb = haystack.as_bytes();
    let nb = needle.as_bytes();
    if nb.is_empty() || nb.len() > hb.len() {
        return None;
    }
    'outer: for i in 0..=(hb.len() - nb.len()) {
        for j in 0..nb.len() {
            if hb[i + j].to_ascii_lowercase() != nb[j].to_ascii_lowercase() {
                continue 'outer;
            }
        }
        return Some(i);
    }
    None
}

pub fn search(
    workspace: &str,
    query: &str,
    max_results: usize,
) -> Result<Vec<crate::SearchResult>, String> {
    let index_path = format!(
        "{}/.confucius/tantivy",
        workspace.trim_end_matches('/').trim_end_matches('\\')
    );

    if !std::path::Path::new(&index_path).exists() {
        return Ok(Vec::new());
    }

    let schema = build_schema();
    let dir = MmapDirectory::open(&index_path)
        .map_err(|e| format!("打开索引目录失败: {}", e))?;
    let index =
        Index::open_or_create(dir, schema.clone()).map_err(|e| format!("打开索引失败: {}", e))?;

    let reader = index
        .reader_builder()
        .reload_policy(tantivy::ReloadPolicy::OnCommitWithDelay)
        .try_into()
        .map_err(|e| format!("创建reader失败: {}", e))?;
    let searcher = reader.searcher();

    let fields = get_fields(&schema);
    let query_parser = QueryParser::for_index(
        &index,
        vec![fields.content, fields.title, fields.tags, fields.file_name],
    );

    let parsed_query = query_parser
        .parse_query(query)
        .map_err(|e| format!("查询解析失败: {}", e))?;

    let top_docs = searcher
        .search(&parsed_query, &TopDocs::with_limit(max_results))
        .map_err(|e| format!("搜索失败: {}", e))?;

    fn field_to_str(val: tantivy::schema::OwnedValue) -> String {
        match val {
            tantivy::schema::OwnedValue::Str(s) => s,
            _ => String::new(),
        }
    }

    let workspace_base = workspace.trim_end_matches('/').trim_end_matches('\\');

    let mut results = Vec::new();
    for (_score, doc_address) in top_docs {
        let retrieved = searcher
            .doc::<tantivy::TantivyDocument>(doc_address)
            .map_err(|e| format!("读取文档失败: {}", e))?;

        let file_path = retrieved
            .get_first(fields.file_path)
            .cloned()
            .map(field_to_str)
            .unwrap_or_default();
        let file_name = retrieved
            .get_first(fields.file_name)
            .cloned()
            .map(field_to_str)
            .unwrap_or_default();

        // 回读源文件生成真实 snippet（文件被删/读失败则回退为空，避免报错）
        let full_path = format!("{}/{}", workspace_base, file_path);
        let (line_number, line_content, match_start, match_end) =
            match std::fs::read_to_string(&full_path) {
                Ok(content) => match locate_match(&content, query) {
                    Some((ln, lc, s, e)) => (ln, lc, s, e),
                    None => (1, String::new(), 0, 0),
                },
                Err(_) => (1, String::new(), 0, 0),
            };

        results.push(crate::SearchResult {
            file_path,
            file_name,
            line_number,
            line_content,
            match_start,
            match_end,
        });
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::knowledge::types::FileMeta;
    use crate::search::indexer::build_search_index;
    use std::collections::HashMap;
    use std::fs;

    fn meta(title: &str, tags: &[&str]) -> FileMeta {
        FileMeta {
            path: String::new(),
            title: title.to_string(),
            links: Vec::new(),
            linked_from: Vec::new(),
            tags: tags.iter().map(|s| s.to_string()).collect(),
            created: String::new(),
            modified: "2026-01-01".to_string(),
        }
    }

    fn write(dir: &str, name: &str, content: &str) {
        fs::write(format!("{}/{}", dir, name), content).unwrap();
    }

    #[test]
    fn search_missing_index_returns_empty() {
        let dir = tempfile::tempdir().unwrap();
        let ws = dir.path().to_string_lossy().to_string();
        // 未建过索引时应返回空而非报错
        let results = search(&ws, "anything", 10).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn index_then_search_finds_document_by_content() {
        let dir = tempfile::tempdir().unwrap();
        let ws = dir.path().to_string_lossy().to_string();
        write(&ws, "alpha.md", "# Alpha\n\nrustacean content here");
        write(&ws, "beta.md", "# Beta\n\ncompletely different text");

        let mut files = HashMap::new();
        files.insert("alpha.md".to_string(), meta("Alpha", &["lang"]));
        files.insert("beta.md".to_string(), meta("Beta", &[]));

        build_search_index(&ws, &files).unwrap();

        let results = search(&ws, "rustacean", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file_path, "alpha.md");
        assert_eq!(results[0].file_name, "alpha.md");
    }

    #[test]
    fn index_then_search_no_match_returns_empty() {
        let dir = tempfile::tempdir().unwrap();
        let ws = dir.path().to_string_lossy().to_string();
        write(&ws, "alpha.md", "only apples and oranges");

        let mut files = HashMap::new();
        files.insert("alpha.md".to_string(), meta("Alpha", &[]));
        build_search_index(&ws, &files).unwrap();

        let results = search(&ws, "bananas", 10).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn search_respects_max_results_limit() {
        let dir = tempfile::tempdir().unwrap();
        let ws = dir.path().to_string_lossy().to_string();
        for i in 0..5 {
            write(&ws, &format!("n{}.md", i), "shared keyword body");
        }
        let mut files = HashMap::new();
        for i in 0..5 {
            files.insert(format!("n{}.md", i), meta(&format!("N{}", i), &[]));
        }
        build_search_index(&ws, &files).unwrap();

        let results = search(&ws, "keyword", 2).unwrap();
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn search_fills_real_snippet() {
        let dir = tempfile::tempdir().unwrap();
        let ws = dir.path().to_string_lossy().to_string();
        let content = "# Title\n\nfirst line has targetToken here\nthird line";
        write(&ws, "snippet.md", content);

        let mut files = HashMap::new();
        files.insert("snippet.md".to_string(), meta("Snippet", &[]));
        build_search_index(&ws, &files).unwrap();

        let results = search(&ws, "targetToken", 10).unwrap();
        assert_eq!(results.len(), 1);
        let r = &results[0];
        assert_eq!(r.line_number, 3);
        assert_eq!(r.line_content, "first line has targetToken here");
        assert!(r.match_start < r.match_end);
        assert_eq!(&r.line_content[r.match_start as usize..r.match_end as usize], "targetToken");
    }

    #[test]
    fn search_is_case_insensitive_for_snippet() {
        let dir = tempfile::tempdir().unwrap();
        let ws = dir.path().to_string_lossy().to_string();
        write(&ws, "case.md", "line with MiXeDcAsE token");

        let mut files = HashMap::new();
        files.insert("case.md".to_string(), meta("Case", &[]));
        build_search_index(&ws, &files).unwrap();

        let results = search(&ws, "mixedcase", 10).unwrap();
        assert_eq!(results.len(), 1);
        let r = &results[0];
        assert_eq!(&r.line_content[r.match_start as usize..r.match_end as usize], "MiXeDcAsE");
    }

    #[test]
    fn locate_match_prefers_whole_phrase() {
        let content = "line one\nhere is the exact phrase match\nlast line";
        let (ln, lc, s, e) = locate_match(content, "exact phrase").unwrap();
        assert_eq!(ln, 2);
        assert_eq!(&lc[s as usize..e as usize], "exact phrase");
    }

    #[test]
    fn locate_match_falls_back_to_single_word() {
        let content = "only foo here\nbar baz qux";
        // "foo bar" 不以整句出现，应回退到第一个词 foo
        let (ln, lc, s, e) = locate_match(content, "foo bar").unwrap();
        assert_eq!(ln, 1);
        assert_eq!(&lc[s as usize..e as usize], "foo");
    }

    #[test]
    fn locate_match_empty_query_returns_none() {
        assert!(locate_match("line", "").is_none());
        assert!(locate_match("", "foo").is_none());
    }
}
