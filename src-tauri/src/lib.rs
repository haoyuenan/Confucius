mod knowledge;
mod search;
mod import;

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

fn is_md_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown")
}

/// 路径安全校验：拒绝 `..` 遍历和空字节注入，并做词法归一化。
///
/// 防御策略：
/// - 空路径 / 含 `\0` / 含 `..` 一律拒绝；
/// - 按组件处理，丢弃 `.` 组件，重建为无冗余组件路径；
/// - 对 `..` 组件（已在上方字符串检查拦截，此处为防御性兜底）再次拒绝，
///   避免 `a/./../b` 这类绕过字符串子串检查的书写。
///
/// 注意：不做 `canonicalize`——命令在使用工作区前缀拼接时依赖原始书写
/// 形式与 knowledge 索引的 `{.confucius/*}` 位置一致，规范化会引入差异。
pub(crate) fn sanitize_path(input: &str) -> Result<PathBuf, String> {
    if input.is_empty() {
        return Err("路径为空".into());
    }
    if input.contains("..") {
        return Err(format!("路径包含非法序列 \"..\": {}", input));
    }
    if input.contains('\0') {
        return Err("路径包含空字节".into());
    }

    let mut cleaned = PathBuf::new();
    for comp in std::path::Path::new(input).components() {
        match comp {
            std::path::Component::CurDir => {}
            std::path::Component::ParentDir => {
                return Err(format!("路径包含非法序列 \"..\": {}", input));
            }
            other => cleaned.push(other.as_os_str()),
        }
    }
    Ok(cleaned)
}

// ── File tree ──

#[derive(Clone, serde::Serialize)]
pub struct FileTreeNode {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub node_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileTreeNode>>,
}

#[tauri::command]
async fn build_file_tree(root_path: String) -> Result<FileTreeNode, String> {
    let root = sanitize_path(&root_path)?;
    tauri::async_runtime::spawn_blocking(move || {
        if !root.exists() {
            return Err(format!("路径不存在: {}", root_path));
        }

        let root_name = root
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| root_path.clone());

        let root_node = FileTreeNode {
            name: root_name,
            path: root_path.clone(),
            node_type: "directory".into(),
            children: Some(vec![]),
        };

        // Use walkdir to build tree recursively
        fn build_node(dir: &std::path::Path) -> Option<FileTreeNode> {
            let name = dir.file_name()?.to_string_lossy().to_string();
            let path = dir.to_string_lossy().to_string();

            let mut children: Vec<FileTreeNode> = Vec::new();
            let entries = std::fs::read_dir(dir).ok()?;

            for entry in entries {
                let entry = entry.ok()?;
                let entry_name = entry.file_name().to_string_lossy().to_string();
                if entry_name.starts_with('.') {
                    continue;
                }
                let entry_path = entry.path();
                if entry_path.is_dir() {
                    if let Some(child) = build_node(&entry_path) {
                        children.push(child);
                    }
                } else if entry_path.is_file() && is_md_file(&entry_name) {
                    children.push(FileTreeNode {
                        name: entry_name,
                        path: entry_path.to_string_lossy().to_string(),
                        node_type: "file".into(),
                        children: None,
                    });
                }
            }

            // 目录下没有任何 .md 文件（也无可递归的子目录包含 .md 文件）→ 跳过
            if children.is_empty() {
                return None;
            }

            // Sort: directories first, then files, alphabetical
            children.sort_by(|a, b| {
                if a.node_type != b.node_type {
                    if a.node_type == "directory" {
                        std::cmp::Ordering::Less
                    } else {
                        std::cmp::Ordering::Greater
                    }
                } else {
                    a.name.to_lowercase().cmp(&b.name.to_lowercase())
                }
            });

            Some(FileTreeNode {
                name,
                path,
                node_type: "directory".into(),
                children: Some(children),
            })
        }

        Ok(build_node(&root).unwrap_or(root_node))
    })
    .await
    .map_err(|e| format!("构建文件树任务失败: {}", e))?
}

// ── Text search ──

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub file_path: String,
    pub file_name: String,
    pub line_number: u32,
    pub line_content: String,
    pub match_start: u32,
    pub match_end: u32,
}

#[tauri::command]
async fn search_text(
    root_path: String,
    query: String,
    case_sensitive: Option<bool>,
    use_regex: Option<bool>,
    max_results: Option<u32>,
) -> Result<Vec<SearchResult>, String> {
    let max_results = max_results.unwrap_or(500) as usize;
    let case_sensitive = case_sensitive.unwrap_or(false);
    let use_regex = use_regex.unwrap_or(false);

    tauri::async_runtime::spawn_blocking(move || {
        // Use Tantivy for non-regex, non-case-sensitive searches
        if !use_regex && !case_sensitive {
            return crate::search::searcher::search(&root_path, &query, max_results);
        }

        use std::sync::atomic::{AtomicBool, Ordering};
        use std::sync::Arc;

        let pattern = if use_regex {
            query.clone()
        } else {
            regex::escape(&query)
        };

        let re = if case_sensitive {
            regex::Regex::new(&pattern)
        } else {
            regex::RegexBuilder::new(&pattern)
                .case_insensitive(true)
                .build()
        }
        .map_err(|e| format!("正则表达式错误: {}", e))?;

        let root = sanitize_path(&root_path)?;
        let stop_flag = Arc::new(AtomicBool::new(false));

        // Collect all .md files first
        let mut files = Vec::new();
        collect_md_files(&root, &mut files);
        files.sort();

        // Search with concurrency (8 tasks), collect results per thread and merge
        let concurrency = 8usize;
        let chunk_size = ((files.len() + concurrency - 1) / concurrency).max(1);

        let chunks: Vec<Vec<PathBuf>> = files.chunks(chunk_size).map(|c| c.to_vec()).collect();

        let thread_results: Vec<Vec<SearchResult>> = std::thread::scope(|s| {
            let mut handles = Vec::new();
            for chunk in chunks {
                let stop = Arc::clone(&stop_flag);
                let re = re.clone();
                handles.push(s.spawn(move || {
                    let mut local_results = Vec::new();
                    for file_path in chunk {
                        if stop.load(Ordering::Relaxed) {
                            break;
                        }
                        let content = match std::fs::read_to_string(&file_path) {
                            Ok(c) => c,
                            Err(_) => continue,
                        };

                        let file_name = file_path
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_default();
                        let fp = file_path.to_string_lossy().to_string();

                        for (i, line) in content.lines().enumerate() {
                            let line_num = (i + 1) as u32;
                            for m in re.find_iter(line) {
                                if local_results.len() >= max_results {
                                    stop.store(true, Ordering::Relaxed);
                                    return local_results;
                                }
                                local_results.push(SearchResult {
                                    file_path: fp.clone(),
                                    file_name: file_name.clone(),
                                    line_number: line_num,
                                    line_content: line.to_string(),
                                    match_start: m.start() as u32,
                                    match_end: m.end() as u32,
                                });
                            }
                        }
                    }
                    local_results
                }));
            }
            handles.into_iter().map(|h| h.join().unwrap_or_default()).collect()
        });

        let mut final_results: Vec<SearchResult> = thread_results.into_iter().flatten().collect();
        final_results.truncate(max_results);
        Ok(final_results)
    })
    .await
    .map_err(|e| format!("搜索任务失败: {}", e))?
}

fn collect_md_files(dir: &PathBuf, files: &mut Vec<PathBuf>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            collect_md_files(&path, files);
        } else if path.is_file() {
            let lower = name.to_lowercase();
            if lower.ends_with(".md") || lower.ends_with(".markdown") {
                files.push(path);
            }
        }
    }
}

// ── File operations (bypasses Tauri fs scope for arbitrary paths) ──

#[derive(Clone, serde::Serialize)]
pub struct FileStat {
    pub size: u64,
    pub modified: String,
    pub is_dir: bool,
}

#[derive(Clone, serde::Serialize)]
pub struct DirEntry {
    pub name: String,
    pub is_directory: bool,
}

#[tauri::command]
async fn read_file_utf8(path: String) -> Result<String, String> {
    let path = sanitize_path(&path)?;
    tauri::async_runtime::spawn_blocking(move || {
        std::fs::read_to_string(&path)
            .map_err(|e| format!("读取文件失败: {}", e))
    })
    .await
    .map_err(|e| format!("读取文件任务失败: {}", e))?
}

/** 根据文件扩展名推断 MIME 类型 */
fn infer_mime(path: &str) -> &str {
    let lower = path.to_lowercase();
    if lower.ends_with(".png") { "image/png" }
    else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") { "image/jpeg" }
    else if lower.ends_with(".gif") { "image/gif" }
    else if lower.ends_with(".svg") { "image/svg+xml" }
    else if lower.ends_with(".webp") { "image/webp" }
    else if lower.ends_with(".ico") { "image/x-icon" }
    else if lower.ends_with(".bmp") { "image/bmp" }
    else { "image/png" }
}

#[tauri::command]
async fn read_file_base64(path: String) -> Result<String, String> {
    let path = sanitize_path(&path)?;
    tauri::async_runtime::spawn_blocking(move || {
        use base64::Engine;
        let bytes = std::fs::read(&path)
            .map_err(|e| format!("读取文件失败: {}", e))?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        let path_str = path.to_string_lossy();
        let mime = infer_mime(&path_str);
        Ok(format!("data:{};base64,{}", mime, b64))
    })
    .await
    .map_err(|e| format!("读取文件任务失败: {}", e))?
}

#[tauri::command]
async fn save_image_file(data_base64: String, file_name: String, target_dir: String) -> Result<String, String> {
    let dir = sanitize_path(&target_dir)?;
    tauri::async_runtime::spawn_blocking(move || {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("创建目录失败: {}", e))?;

        // 从 data:image/...;base64, 格式中剥离前缀（如果存在）
        let b64_data = if let Some(pos) = data_base64.find("base64,") {
            &data_base64[pos + 7..]
        } else {
            &data_base64
        };

        use base64::Engine;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(b64_data)
            .map_err(|e| format!("base64 解码失败: {}", e))?;

        let file_path = dir.join(&file_name);
        std::fs::write(&file_path, &bytes)
            .map_err(|e| format!("写入图片失败: {}", e))?;

        Ok(file_path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| format!("保存图片任务失败: {}", e))?
}

#[tauri::command]
async fn write_file_utf8(path: String, content: String) -> Result<(), String> {
    let path = sanitize_path(&path)?;
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("创建目录失败: {}", e))?;
        }
        std::fs::write(&path, &content)
            .map_err(|e| format!("写入文件失败: {}", e))
    })
    .await
    .map_err(|e| format!("写入文件任务失败: {}", e))?
}

#[tauri::command]
async fn create_file(parent_path: String, file_name: String) -> Result<String, String> {
    let dir = sanitize_path(&parent_path)?;
    tauri::async_runtime::spawn_blocking(move || {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("创建目录失败: {}", e))?;
        let file_path = dir.join(&file_name);
        std::fs::write(&file_path, "")
            .map_err(|e| format!("创建文件失败: {}", e))?;
        Ok(file_path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| format!("创建文件任务失败: {}", e))?
}

#[tauri::command]
async fn create_dir(parent_path: String, dir_name: String) -> Result<String, String> {
    let dir = sanitize_path(&parent_path)?.join(&dir_name);
    tauri::async_runtime::spawn_blocking(move || {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("创建目录失败: {}", e))?;
        Ok(dir.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| format!("创建目录任务失败: {}", e))?
}

#[tauri::command]
async fn rename_item(old_path: String, new_name: String) -> Result<(), String> {
    let old = sanitize_path(&old_path)?;
    tauri::async_runtime::spawn_blocking(move || {
        let parent = old.parent().ok_or("无法获取父目录")?;
        let new_path = parent.join(&new_name);
        std::fs::rename(old, &new_path)
            .map_err(|e| format!("重命名失败: {}", e))
    })
    .await
    .map_err(|e| format!("重命名任务失败: {}", e))?
}

#[tauri::command]
async fn delete_item(target_path: String) -> Result<(), String> {
    let path = sanitize_path(&target_path)?;
    tauri::async_runtime::spawn_blocking(move || {
        if path.is_dir() {
            std::fs::remove_dir_all(path)
                .map_err(|e| format!("删除目录失败: {}", e))?;
        } else {
            std::fs::remove_file(path)
                .map_err(|e| format!("删除文件失败: {}", e))?;
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("删除任务失败: {}", e))?
}

#[tauri::command]
async fn stat_file(path: String) -> Result<FileStat, String> {
    let path = sanitize_path(&path)?;
    tauri::async_runtime::spawn_blocking(move || {
        let meta = std::fs::metadata(&path)
            .map_err(|e| format!("获取文件信息失败: {}", e))?;
        let modified = meta
            .modified()
            .ok()
            .map(|t| {
                let dur = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                dur.as_secs().to_string()
            })
            .unwrap_or_default();
        Ok(FileStat {
            size: meta.len(),
            modified,
            is_dir: meta.is_dir(),
        })
    })
    .await
    .map_err(|e| format!("获取文件信息任务失败: {}", e))?
}

#[tauri::command]
async fn read_dir_entries(path: String) -> Result<Vec<DirEntry>, String> {
    let path = sanitize_path(&path)?;
    tauri::async_runtime::spawn_blocking(move || {
        let entries = std::fs::read_dir(&path)
            .map_err(|e| format!("读取目录失败: {}", e))?;
        let mut result = Vec::new();
        for entry in entries {
            let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }
            let is_directory = entry.file_type()
                .map(|t| t.is_dir())
                .unwrap_or(false);
            result.push(DirEntry { name, is_directory });
        }
        result.sort_by(|a, b| {
            if a.is_directory != b.is_directory {
                if a.is_directory { std::cmp::Ordering::Less } else { std::cmp::Ordering::Greater }
            } else {
                a.name.to_lowercase().cmp(&b.name.to_lowercase())
            }
        });
        Ok(result)
    })
    .await
    .map_err(|e| format!("读取目录任务失败: {}", e))?
}

// ── File watcher ──

use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::Duration;

struct WatcherState {
    _watcher: Option<RecommendedWatcher>,
    stop_flag: Arc<AtomicBool>,
    _thread: Option<JoinHandle<()>>,
}

#[derive(Clone, serde::Serialize)]
struct FileChangeEvent {
    paths: Vec<String>,
}

#[tauri::command]
fn start_file_watcher(app: AppHandle, root_path: String) -> Result<(), String> {
    let (tx, rx) = mpsc::channel::<notify::Result<notify::Event>>();

    let mut watcher = RecommendedWatcher::new(tx, Config::default())
        .map_err(|e| format!("创建文件监听失败: {}", e))?;

    watcher
        .watch(
            std::path::PathBuf::from(&root_path).as_path(),
            RecursiveMode::Recursive,
        )
        .map_err(|e| format!("监听路径失败: {}", e))?;

    let app_clone = app.clone();
    let stop_flag = Arc::new(AtomicBool::new(false));
    let flag_clone = Arc::clone(&stop_flag);

    // Spawn a thread that collects changed paths and emits Tauri events (debounced)
    let handle = std::thread::spawn(move || {
        use std::collections::HashSet;

        let mut pending: HashSet<String> = HashSet::new();
        let mut last_flush = std::time::Instant::now();

        loop {
            match rx.recv_timeout(Duration::from_millis(500)) {
                Ok(event) => {
                    if let Ok(ev) = event {
                        for p in ev.paths {
                            let s = p.to_string_lossy().to_string();
                            if is_md_file(&s) {
                                pending.insert(s);
                            }
                        }
                    }
                    let now = std::time::Instant::now();
                    if now.duration_since(last_flush) >= Duration::from_millis(500)
                        && !pending.is_empty()
                    {
                        let paths: Vec<String> = pending.drain().collect();
                        let _ = app_clone.emit("file-tree-changed", FileChangeEvent { paths });
                        last_flush = now;
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    // 空闲时冲刷积压的变更，避免低频变更滞留
                    if !pending.is_empty() {
                        let paths: Vec<String> = pending.drain().collect();
                        let _ = app_clone.emit("file-tree-changed", FileChangeEvent { paths });
                        last_flush = std::time::Instant::now();
                    }
                    if flag_clone.load(Ordering::Relaxed) {
                        break;
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    let state = app.state::<Mutex<Option<WatcherState>>>();
    let mut guard = state.lock().unwrap();
    *guard = Some(WatcherState {
        _watcher: Some(watcher),
        stop_flag,
        _thread: Some(handle),
    });

    Ok(())
}

#[tauri::command]
fn stop_file_watcher(app: AppHandle) -> Result<(), String> {
    let state = app.state::<Mutex<Option<WatcherState>>>();
    let mut guard = state.lock().unwrap();
    if let Some(mut ws) = guard.take() {
        // Signal the thread to stop
        ws.stop_flag.store(true, Ordering::Relaxed);
        // Drop the watcher to close the notification channel
        drop(ws._watcher.take());
        // Wait for the thread to finish. stop_flag + dropping the watcher
        // (closing the channel) make the loop exit promptly, so this join
        // returns quickly.
        if let Some(handle) = ws._thread.take() {
            let _ = handle.join();
        }
    }
    Ok(())
}

// ── App info ──

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// ── Init ──

pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(None::<WatcherState>))
        .manage(Mutex::new(None::<knowledge::types::KnowledgeIndex>))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            build_file_tree,
            search_text,
            read_file_utf8,
            read_file_base64,
            save_image_file,
            write_file_utf8,
            create_file,
            create_dir,
            rename_item,
            delete_item,
            stat_file,
            read_dir_entries,
            start_file_watcher,
            stop_file_watcher,
            get_app_version,
            knowledge::knowledge_init_loaded,
            knowledge::knowledge_get_backlinks,
            knowledge::knowledge_get_graph,
            knowledge::knowledge_get_tags,
            knowledge::knowledge_reindex,
            import::check_pandoc,
            import::import_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_path_accepts_normal_path() {
        let result = sanitize_path("/home/user/notes/file.md");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), PathBuf::from("/home/user/notes/file.md"));
    }

    #[test]
    fn sanitize_path_rejects_empty() {
        let result = sanitize_path("");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("为空"));
    }

    #[test]
    fn sanitize_path_rejects_dotdot() {
        let result = sanitize_path("/home/user/../../etc/passwd");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains(".."));
    }

    #[test]
    fn sanitize_path_rejects_null_byte() {
        let result = sanitize_path("/home/user/\0file.md");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("空字节"));
    }

    #[test]
    fn sanitize_path_accepts_windows_path() {
        let result = sanitize_path("D:\\Notes\\file.md");
        assert!(result.is_ok());
    }

    #[test]
    fn sanitize_path_rejects_dotdot_prefix() {
        let result = sanitize_path("../secrets");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains(".."));
    }

    #[test]
    fn sanitize_path_rejects_mixed_dotdot_traversal() {
        // 字符串层面不直接含 ".."，但组件归一化后仍应拒绝（如 a/./../b）
        let result = sanitize_path("a/./../b");
        assert!(result.is_err());
    }

    #[test]
    fn sanitize_path_normalizes_curdir() {
        let result = sanitize_path("/home/user/./notes/file.md").unwrap();
        assert_eq!(result, PathBuf::from("/home/user/notes/file.md"));
    }

    #[test]
    fn sanitize_path_refuses_escaped_absolute() {
        // 绝对路径含 .. 后缀，应被字符串检查拒绝
        let result = sanitize_path("/home/user/../secrets");
        assert!(result.is_err());
    }

    #[test]
    fn is_md_file_positive() {
        assert!(is_md_file("readme.md"));
        assert!(is_md_file("README.MD"));
        assert!(is_md_file("notes.markdown"));
    }

    #[test]
    fn is_md_file_negative() {
        assert!(!is_md_file("notes.txt"));
        assert!(!is_md_file("image.png"));
        assert!(!is_md_file("Makefile"));
        assert!(!is_md_file("readme.md.bak"));
    }
}
