use crate::search::schema::*;
use std::fs;
use std::path::Path;
use tantivy::directory::MmapDirectory;
use tantivy::Index;

fn open_writer(index: &Index) -> Result<tantivy::IndexWriter, String> {
    index
        .writer(50_000_000)
        .map_err(|e| format!("创建索引写入器失败: {}", e))
}

pub fn build_search_index(
    workspace: &str,
    files: &std::collections::HashMap<String, crate::knowledge::types::FileMeta>,
) -> Result<(), String> {
    let index_path = format!(
        "{}/.confucius/tantivy",
        workspace.trim_end_matches('/').trim_end_matches('\\')
    );

    let _ = fs::remove_dir_all(&index_path);
    fs::create_dir_all(&index_path)
        .map_err(|e| format!("创建索引目录失败: {}", e))?;

    let schema = build_schema();
    let dir = MmapDirectory::open(&index_path)
        .map_err(|e| format!("打开索引目录失败: {}", e))?;
    let index = Index::open_or_create(dir, schema.clone())
        .map_err(|e| format!("创建索引失败: {}", e))?;

    let mut writer = open_writer(&index)?;

    let fields = get_fields(&schema);
    let workspace_base = workspace.trim_end_matches('/').trim_end_matches('\\');

    let mut count = 0u64;
    for (rel_path, meta) in files {
        let full_path = format!("{}/{}", workspace_base, rel_path);
        let content = match fs::read_to_string(&full_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let file_name = Path::new(&full_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        let tag_str = meta.tags.join(", ");

        let mut doc = tantivy::TantivyDocument::new();
        doc.add_text(fields.file_path, rel_path.clone());
        doc.add_text(fields.file_name, &file_name);
        doc.add_text(fields.content, &content);
        doc.add_text(fields.title, &meta.title);
        doc.add_text(fields.tags, &tag_str);
        doc.add_text(fields.modified, &meta.modified);
        let _ = writer.add_document(doc);
        count += 1;
    }

    writer
        .commit()
        .map_err(|e| format!("提交索引失败: {}", e))?;

    println!("[tantivy] indexed {} documents", count);
    Ok(())
}

pub fn add_document(
    workspace: &str,
    rel_path: &str,
    title: &str,
    tags: &[String],
    modified: &str,
) -> Result<(), String> {
    let index_path = format!(
        "{}/.confucius/tantivy",
        workspace.trim_end_matches('/').trim_end_matches('\\')
    );

    if !Path::new(&index_path).exists() {
        return Ok(());
    }

    let schema = build_schema();
    let dir = MmapDirectory::open(&index_path).map_err(|e| format!("打开索引失败: {}", e))?;
    let index = Index::open_or_create(dir, schema.clone())
        .map_err(|e| format!("打开索引失败: {}", e))?;
    let mut writer = open_writer(&index)?;

    let fields = get_fields(&schema);
    let workspace_base = workspace.trim_end_matches('/').trim_end_matches('\\');
    let full_path = format!("{}/{}", workspace_base, rel_path);
    let file_name = Path::new(&full_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let content = match fs::read_to_string(&full_path) {
        Ok(c) => c,
        Err(_) => return Ok(()),
    };

    // 先删除该路径的旧文档再写入，避免同一文件重复索引（搜索结果翻倍）
    let term = tantivy::Term::from_field_text(fields.file_path, rel_path);
    writer.delete_term(term);

    let mut doc = tantivy::TantivyDocument::new();
    doc.add_text(fields.file_path, rel_path);
    doc.add_text(fields.file_name, &file_name);
    doc.add_text(fields.content, &content);
    doc.add_text(fields.title, title);
    doc.add_text(fields.tags, &tags.join(", "));
    doc.add_text(fields.modified, modified);
    writer
        .add_document(doc)
        .map_err(|e| format!("写入索引失败: {}", e))?;

    writer.commit().map_err(|e| format!("提交索引失败: {}", e))?;
    Ok(())
}

pub fn remove_document(workspace: &str, rel_path: &str) -> Result<(), String> {
    let index_path = format!(
        "{}/.confucius/tantivy",
        workspace.trim_end_matches('/').trim_end_matches('\\')
    );

    if !Path::new(&index_path).exists() {
        return Ok(());
    }

    let schema = build_schema();
    let dir = MmapDirectory::open(&index_path).map_err(|e| format!("打开索引失败: {}", e))?;
    let index = Index::open_or_create(dir, schema.clone())
        .map_err(|e| format!("打开索引失败: {}", e))?;
    let mut writer = open_writer(&index)?;

    let fields = get_fields(&schema);
    let term = tantivy::Term::from_field_text(fields.file_path, rel_path);
    writer.delete_term(term);
    writer.commit().map_err(|e| format!("删除文档失败: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::knowledge::types::FileMeta;
    use crate::search::searcher::search;
    use std::collections::HashMap;

    fn meta(title: &str) -> FileMeta {
        FileMeta {
            path: String::new(),
            title: title.to_string(),
            links: Vec::new(),
            linked_from: Vec::new(),
            tags: Vec::new(),
            created: String::new(),
            modified: "2026-01-01".to_string(),
        }
    }

    #[test]
    fn add_document_twice_does_not_duplicate() {
        let dir = tempfile::tempdir().unwrap();
        let ws = dir.path().to_string_lossy().to_string();
        fs::write(format!("{}/a.md", ws), "# Alpha\n\nunique-dup-token body").unwrap();

        let mut files = HashMap::new();
        files.insert("a.md".to_string(), meta("Alpha"));
        build_search_index(&ws, &files).unwrap();

        add_document(&ws, "a.md", "Alpha", &[], "2026-01-01").unwrap();
        add_document(&ws, "a.md", "Alpha", &[], "2026-01-02").unwrap();

        let results = search(&ws, "unique-dup-token", 10).unwrap();
        assert_eq!(results.len(), 1, "同一文件重复 add 不应产生重复文档");
        assert_eq!(results[0].file_path, "a.md");
    }

    #[test]
    fn add_after_remove_is_indexed_once() {
        let dir = tempfile::tempdir().unwrap();
        let ws = dir.path().to_string_lossy().to_string();
        fs::write(format!("{}/a.md", ws), "# Alpha\n\nreappear-token body").unwrap();

        let mut files = HashMap::new();
        files.insert("a.md".to_string(), meta("Alpha"));
        build_search_index(&ws, &files).unwrap();

        remove_document(&ws, "a.md").unwrap();
        assert!(search(&ws, "reappear-token", 10).unwrap().is_empty());

        add_document(&ws, "a.md", "Alpha", &[], "2026-01-03").unwrap();
        let results = search(&ws, "reappear-token", 10).unwrap();
        assert_eq!(results.len(), 1);
    }
}
