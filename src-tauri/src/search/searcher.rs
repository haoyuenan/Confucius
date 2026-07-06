use crate::search::schema::*;
use tantivy::collector::TopDocs;
use tantivy::directory::MmapDirectory;
use tantivy::query::QueryParser;
use tantivy::Index;

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

    let query = query_parser
        .parse_query(query)
        .map_err(|e| format!("查询解析失败: {}", e))?;

    let top_docs = searcher
        .search(&query, &TopDocs::with_limit(max_results))
        .map_err(|e| format!("搜索失败: {}", e))?;

    fn field_to_str(val: tantivy::schema::OwnedValue) -> String {
        match val {
            tantivy::schema::OwnedValue::Str(s) => s,
            _ => String::new(),
        }
    }

    let mut results = Vec::new();
    for (_score, doc_address) in top_docs {
        let retrieved = searcher.doc::<tantivy::TantivyDocument>(doc_address)
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

        results.push(crate::SearchResult {
            file_path,
            file_name,
            line_number: 1,
            line_content: String::new(),
            match_start: 0,
            match_end: 0,
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
}

