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

    let mut doc = tantivy::TantivyDocument::new();
    doc.add_text(fields.file_path, rel_path);
    doc.add_text(fields.file_name, &file_name);
    doc.add_text(fields.content, &content);
    doc.add_text(fields.title, title);
    doc.add_text(fields.tags, &tags.join(", "));
    doc.add_text(fields.modified, modified);
    let _ = writer.add_document(doc);

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
