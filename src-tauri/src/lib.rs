use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

fn is_md_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown")
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
fn build_file_tree(root_path: String) -> Result<FileTreeNode, String> {
    let root = PathBuf::from(&root_path);
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

    // Use walkdir with max depth 0 to get immediate children, then build recursively
    fn build_node(dir: &std::path::Path, depth: usize) -> Option<FileTreeNode> {
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
                if let Some(child) = build_node(&entry_path, depth + 1) {
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

    Ok(build_node(&root, 0).unwrap_or(root_node))
}

// ── Text search ──

#[derive(Clone, serde::Serialize)]
pub struct SearchResult {
    pub file_path: String,
    pub file_name: String,
    pub line_number: u32,
    pub line_content: String,
    pub match_start: u32,
    pub match_end: u32,
}

#[tauri::command]
fn search_text(
    root_path: String,
    query: String,
    case_sensitive: Option<bool>,
    use_regex: Option<bool>,
    max_results: Option<u32>,
) -> Result<Vec<SearchResult>, String> {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    let max_results = max_results.unwrap_or(500) as usize;
    let case_sensitive = case_sensitive.unwrap_or(false);
    let use_regex = use_regex.unwrap_or(false);

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

    let root = PathBuf::from(&root_path);
    let stop_flag = Arc::new(AtomicBool::new(false));

    // Collect all .md files first
    let mut files = Vec::new();
    collect_md_files(&root, &mut files);
    files.sort();

    // Search with concurrency (8 tasks), collect results per thread and merge
    let concurrency = 8usize;
    let chunk_size = (files.len() + concurrency - 1).max(1);

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
fn read_file_utf8(path: String) -> Result<String, String> {
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取文件失败: {}", e))?;
    Ok(content)
}

#[tauri::command]
fn write_file_utf8(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }
    std::fs::write(&path, &content)
        .map_err(|e| format!("写入文件失败: {}", e))?;
    Ok(())
}

#[tauri::command]
fn create_file(parent_path: String, file_name: String) -> Result<String, String> {
    let dir = std::path::Path::new(&parent_path);
    std::fs::create_dir_all(dir)
        .map_err(|e| format!("创建目录失败: {}", e))?;
    let file_path = dir.join(&file_name);
    std::fs::write(&file_path, "")
        .map_err(|e| format!("创建文件失败: {}", e))?;
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn create_dir(parent_path: String, dir_name: String) -> Result<String, String> {
    let dir = std::path::Path::new(&parent_path).join(&dir_name);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("创建目录失败: {}", e))?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn rename_item(old_path: String, new_name: String) -> Result<(), String> {
    let old = std::path::Path::new(&old_path);
    let parent = old.parent().ok_or("无法获取父目录")?;
    let new_path = parent.join(&new_name);
    std::fs::rename(old, &new_path)
        .map_err(|e| format!("重命名失败: {}", e))?;
    Ok(())
}

#[tauri::command]
fn delete_item(target_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&target_path);
    if path.is_dir() {
        std::fs::remove_dir_all(path)
            .map_err(|e| format!("删除目录失败: {}", e))?;
    } else {
        std::fs::remove_file(path)
            .map_err(|e| format!("删除文件失败: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn stat_file(path: String) -> Result<FileStat, String> {
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
}

#[tauri::command]
fn read_dir_entries(path: String) -> Result<Vec<DirEntry>, String> {
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
}

// ── Run code (Python execution) ──

#[tauri::command]
fn run_code(language: String, code: String) -> Result<String, String> {
    if language != "python" {
        return Err(format!("不支持的语言: {}", language));
    }

    let output = std::process::Command::new("python")
        .arg("-c")
        .arg(&code)
        .output()
        .map_err(|e| format!("执行失败: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !stderr.is_empty() {
        Ok(format!("STDERR:\n{}", stderr))
    } else {
        Ok(stdout)
    }
}

// ── File watcher ──

struct WatcherState {
    _watcher: Option<notify_debouncer_full::notify::RecommendedWatcher>,
}

#[tauri::command]
fn start_file_watcher(app: AppHandle, root_path: String) -> Result<(), String> {
    use notify_debouncer_full::notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
    use std::sync::mpsc;
    use std::time::Duration;

    let (tx, rx) = mpsc::channel::<notify_debouncer_full::notify::Result<notify_debouncer_full::notify::Event>>();

    let mut watcher = RecommendedWatcher::new(tx, Config::default())
        .map_err(|e| format!("创建文件监听失败: {}", e))?;

    watcher
        .watch(
            std::path::PathBuf::from(&root_path).as_path(),
            RecursiveMode::Recursive,
        )
        .map_err(|e| format!("监听路径失败: {}", e))?;

    let app_clone = app.clone();
    // Spawn a thread that reads events and emits Tauri events (debounced)
    std::thread::spawn(move || {
        let mut last_emit = std::time::Instant::now();
        for _ in rx {
            let now = std::time::Instant::now();
            if now.duration_since(last_emit) >= Duration::from_millis(500) {
                let _ = app_clone.emit("file-tree-changed", ());
                last_emit = now;
            }
        }
    });

    let state = app.state::<Mutex<Option<WatcherState>>>();
    let mut guard = state.lock().unwrap();
    *guard = Some(WatcherState {
        _watcher: Some(watcher),
    });

    Ok(())
}

#[tauri::command]
fn stop_file_watcher(app: AppHandle) -> Result<(), String> {
    let state = app.state::<Mutex<Option<WatcherState>>>();
    let mut guard = state.lock().unwrap();
    *guard = None; // Drop old watcher, stopping it
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
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            build_file_tree,
            search_text,
            read_file_utf8,
            write_file_utf8,
            create_file,
            create_dir,
            rename_item,
            delete_item,
            stat_file,
            read_dir_entries,
            run_code,
            start_file_watcher,
            stop_file_watcher,
            get_app_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
