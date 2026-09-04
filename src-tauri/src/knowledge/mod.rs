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

type IndexState = Mutex<Option<KnowledgeIndex>>;

#[tauri::command]
pub async fn knowledge_init_loaded(app: AppHandle, workspace_path: String) -> Result<(), String> {
    let index = tauri::async_runtime::spawn_blocking(move || {
        let index = match idx::load_index(&workspace_path) {
            Ok(i) => i,
            Err(_) => idx::full_scan(&workspace_path)?,
        };
        idx::save_index(&workspace_path, &index)?;

        // Build Tantivy search index
        let _ = crate::search::indexer::build_search_index(&workspace_path, &index.files);
        Ok::<_, String>(index)
    })
    .await
    .map_err(|e| e.to_string())??;

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

/// 校验 reindex 参数：路径需通过安全校验且位于工作区内
fn validate_reindex_path(workspace_path: &str, file_path: &str) -> Result<(), String> {
    crate::sanitize_path(workspace_path)?;
    crate::sanitize_path(file_path)?;
    let ws = workspace_path.replace('\\', "/");
    let ws = ws.trim_end_matches('/');
    let prefix = format!("{}/", ws);
    let fp = file_path.replace('\\', "/");
    let within = if cfg!(windows) {
        fp.to_lowercase().starts_with(&prefix.to_lowercase())
    } else {
        fp.starts_with(&prefix)
    };
    if !within {
        return Err(format!("文件不在工作区内: {}", file_path));
    }
    Ok(())
}

#[tauri::command]
pub async fn knowledge_reindex(
    app: AppHandle,
    workspace_path: String,
    file_path: String,
) -> Result<(), String> {
    validate_reindex_path(&workspace_path, &file_path)?;

    let updated = tauri::async_runtime::spawn_blocking(move || {
        idx::reindex_file(&workspace_path, &file_path)?;
        let updated = idx::load_index(&workspace_path)?;

        // Update Tantivy search index
        let rel = relative(&workspace_path, &file_path);
        if let Some(meta) = updated.files.get(&rel) {
            crate::search::indexer::add_document(
                &workspace_path,
                &rel,
                &meta.title,
                &meta.tags,
                &meta.modified,
            )?;
        } else {
            crate::search::indexer::remove_document(&workspace_path, &rel)?;
        }
        Ok::<_, String>(updated)
    })
    .await
    .map_err(|e| e.to_string())??;

    let state = app.state::<IndexState>();
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    *guard = Some(updated);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_reindex_path_accepts_file_inside_workspace() {
        let r = validate_reindex_path("C:/notes", "C:/notes/sub/a.md");
        assert!(r.is_ok());
    }

    #[test]
    fn validate_reindex_path_accepts_nested_file() {
        let r = validate_reindex_path("/home/u/notes", "/home/u/notes/a/b.md");
        assert!(r.is_ok());
    }

    #[test]
    fn validate_reindex_path_rejects_outside_file() {
        let r = validate_reindex_path("C:/notes", "C:/other/a.md");
        assert!(r.is_err());
    }

    #[test]
    fn validate_reindex_path_rejects_prefix_overlap() {
        let r = validate_reindex_path("C:/notes", "C:/notes2/a.md");
        assert!(r.is_err());
    }

    #[test]
    fn validate_reindex_path_rejects_dotdot() {
        let r = validate_reindex_path("C:/notes", "C:/notes/../secrets.md");
        assert!(r.is_err());
    }

    #[test]
    fn validate_reindex_path_rejects_empty() {
        let r = validate_reindex_path("", "");
        assert!(r.is_err());
    }

    #[test]
    fn validate_reindex_path_rejects_workspace_itself() {
        let r = validate_reindex_path("C:/notes", "C:/notes");
        assert!(r.is_err());
    }
}
