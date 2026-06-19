pub mod types;
pub mod parser;
pub mod indexer;
pub mod resolver;

use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use crate::knowledge::indexer as idx;
use crate::knowledge::resolver as res;
use crate::knowledge::types::KnowledgeIndex;

fn index_path(workspace: &str) -> String {
    let w = workspace.trim_end_matches('/').trim_end_matches('\\');
    format!("{}/.confucius/index.json", w)
}

pub fn relative(workspace: &str, full_path: &str) -> String {
    let w = workspace.replace('\\', "/").trim_end_matches('/').to_string();
    let f = full_path.replace('\\', "/");
    let prefix = format!("{}/", w);
    f.strip_prefix(&prefix).unwrap_or(&f).to_string()
}

pub fn join_path(base: &str, rel: &str) -> String {
    let b = base.trim_end_matches('/').trim_end_matches('\\');
    let r = rel.trim_start_matches('/').trim_start_matches('\\');
    format!("{}/{}", b, r)
}

type IndexState = Mutex<Option<KnowledgeIndex>>;

#[tauri::command]
pub fn knowledge_init(workspace_path: String) -> Result<(), String> {
    let index = idx::full_scan(&workspace_path)?;
    idx::save_index(&workspace_path, &index)
}

#[tauri::command]
pub fn knowledge_init_loaded(app: AppHandle, workspace_path: String) -> Result<(), String> {
    let index = match idx::load_index(&workspace_path) {
        Ok(i) => i,
        Err(_) => idx::full_scan(&workspace_path)?,
    };
    idx::save_index(&workspace_path, &index)?;

    // Build Tantivy search index
    let _ = crate::search::indexer::build_search_index(&workspace_path, &index.files);

    let state = app.state::<IndexState>();
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    *guard = Some(index);
    Ok(())
}

#[tauri::command]
pub fn knowledge_get_backlinks(
    app: AppHandle,
    file_path: String,
) -> Result<Vec<types::Link>, String> {
    let state = app.state::<IndexState>();
    let guard = state.lock().map_err(|e| e.to_string())?;
    match guard.as_ref() {
        Some(index) => Ok(res::get_backlinks(index, &file_path)),
        None => Err("索引未初始化，请先调用 knowledge_init_loaded".into()),
    }
}

#[tauri::command]
pub fn knowledge_get_graph(
    app: AppHandle,
    file_path: Option<String>,
) -> Result<serde_json::Value, String> {
    let state = app.state::<IndexState>();
    let guard = state.lock().map_err(|e| e.to_string())?;
    match guard.as_ref() {
        Some(index) => {
            let (nodes, links) =
                res::get_graph_data(index, file_path.as_deref());
            Ok(serde_json::json!({ "nodes": nodes, "links": links }))
        }
        None => Err("索引未初始化，请先调用 knowledge_init_loaded".into()),
    }
}

#[tauri::command]
pub fn knowledge_get_tags(
    app: AppHandle,
) -> Result<std::collections::HashMap<String, Vec<String>>, String> {
    let state = app.state::<IndexState>();
    let guard = state.lock().map_err(|e| e.to_string())?;
    match guard.as_ref() {
        Some(index) => Ok(res::get_tags(index)),
        None => Err("索引未初始化，请先调用 knowledge_init_loaded".into()),
    }
}

#[tauri::command]
pub fn knowledge_reindex(
    app: AppHandle,
    workspace_path: String,
    file_path: String,
) -> Result<(), String> {
    idx::reindex_file(&workspace_path, &file_path)?;
    let updated = idx::load_index(&workspace_path)?;

    // Update Tantivy search index
    let rel = relative(&workspace_path, &file_path);
    if let Some(meta) = updated.files.get(&rel) {
        let _ = crate::search::indexer::add_document(
            &workspace_path,
            &rel,
            &meta.title,
            &meta.tags,
            &meta.modified,
        );
    } else {
        let _ = crate::search::indexer::remove_document(&workspace_path, &rel);
    }

    let state = app.state::<IndexState>();
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    *guard = Some(updated);
    Ok(())
}
