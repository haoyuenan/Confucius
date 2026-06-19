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
