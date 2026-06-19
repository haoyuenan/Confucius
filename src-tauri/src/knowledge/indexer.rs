use crate::knowledge::parser::*;
use crate::knowledge::types::*;
use crate::knowledge::{index_path, relative};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

pub fn full_scan(workspace: &str) -> Result<KnowledgeIndex, String> {
    let mut files = HashMap::new();
    scan_directory(workspace, workspace, &mut files)?;
    let mut links = Vec::new();
    resolve_links(&mut files, &mut links);
    let tags = build_tag_index(&files);

    Ok(KnowledgeIndex {
        version: 1,
        files,
        links,
        tags,
    })
}

fn scan_directory(
    workspace: &str,
    dir_path: &str,
    files: &mut HashMap<String, FileMeta>,
) -> Result<(), String> {
    let entries = fs::read_dir(dir_path).map_err(|e| format!("读取目录失败: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("目录项错误: {}", e))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }

        let full_path = entry.path();
        let full_str = full_path.to_string_lossy().to_string();

        if full_path.is_dir() {
            scan_directory(workspace, &full_str, files)?;
        } else if name.ends_with(".md") || name.ends_with(".markdown") {
            let content = match fs::read_to_string(&full_str) {
                Ok(c) => c,
                Err(_) => continue,
            };
            let rel = relative(workspace, &full_str);
            let modified = fs::metadata(&full_str)
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    t.duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs()
                        .to_string()
                })
                .unwrap_or_default();

            files.insert(
                rel.clone(),
                FileMeta {
                    path: rel,
                    title: extract_title(&full_str, &content),
                    links: parse_wikilinks(&content),
                    linked_from: Vec::new(),
                    tags: parse_tags(&content),
                    created: parse_frontmatter(&content).1.unwrap_or_default(),
                    modified,
                },
            );
        }
    }
    Ok(())
}

fn resolve_links(files: &mut HashMap<String, FileMeta>, links: &mut Vec<Link>) {
    let mut title_to_path: HashMap<String, String> = HashMap::new();
    for (fp, meta) in files.iter() {
        title_to_path
            .entry(meta.title.to_lowercase())
            .or_insert_with(|| fp.clone());
        let base = Path::new(fp)
            .file_stem()
            .map(|s| s.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        title_to_path
            .entry(base)
            .or_insert_with(|| fp.clone());
    }

    for (src_path, meta) in files.clone().iter() {
        for target in &meta.links {
            let lower = target.to_lowercase();
            let resolved = title_to_path.contains_key(&lower);
            let target_path = title_to_path.get(&lower).cloned();

            links.push(Link {
                source: src_path.clone(),
                target: target.clone(),
                resolved,
                target_path,
            });

            if let Some(tp) = title_to_path.get(&lower) {
                if let Some(target_meta) = files.get_mut(tp) {
                    if !target_meta.linked_from.contains(src_path) {
                        target_meta.linked_from.push(src_path.clone());
                    }
                }
            }
        }
    }
}

fn build_tag_index(files: &HashMap<String, FileMeta>) -> HashMap<String, Vec<String>> {
    let mut tags: HashMap<String, Vec<String>> = HashMap::new();
    for (fp, meta) in files {
        for tag in &meta.tags {
            tags.entry(tag.clone()).or_default().push(fp.clone());
        }
    }
    tags
}

pub fn save_index(workspace: &str, index: &KnowledgeIndex) -> Result<(), String> {
    let path_str = index_path(workspace);
    let path = Path::new(&path_str);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }
    let json = serde_json::to_string_pretty(index)
        .map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&path_str, json).map_err(|e| format!("写入索引失败: {}", e))?;
    Ok(())
}

pub fn load_index(workspace: &str) -> Result<KnowledgeIndex, String> {
    let path_str = index_path(workspace);
    if !Path::new(&path_str).exists() {
        return Err("索引文件不存在".into());
    }
    let content =
        fs::read_to_string(&path_str).map_err(|e| format!("读取索引失败: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("解析索引失败: {}", e))
}

pub fn reindex_file(workspace: &str, file_path: &str) -> Result<(), String> {
    let mut index =
        load_index(workspace).unwrap_or_else(|_| KnowledgeIndex {
            version: 1,
            files: HashMap::new(),
            links: Vec::new(),
            tags: HashMap::new(),
        });

    let rel = relative(workspace, file_path);
    let path = Path::new(file_path);

    if !path.exists() {
        // File deleted → remove from index
        index.files.remove(&rel);
        index.links.retain(|l| l.source != rel);
        for meta in index.files.values_mut() {
            meta.linked_from.retain(|p| p != &rel);
        }

        // Rebuild link graph
        index.links.clear();
        let mut files = index.files.clone();
        resolve_links(&mut files, &mut index.links);
        index.files = files;
        index.tags = build_tag_index(&index.files);
        return save_index(workspace, &index);
    }

    let content = match fs::read_to_string(file_path) {
        Ok(c) => c,
        Err(e) => return Err(format!("读取文件失败: {}", e)),
    };
    let modified = fs::metadata(file_path)
        .ok()
        .and_then(|m| m.modified().ok())
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
                .to_string()
        })
        .unwrap_or_default();

    let meta = FileMeta {
        path: rel.clone(),
        title: extract_title(file_path, &content),
        links: parse_wikilinks(&content),
        linked_from: Vec::new(),
        tags: parse_tags(&content),
        created: parse_frontmatter(&content).1.unwrap_or_default(),
        modified,
    };

    index.files.insert(rel.clone(), meta);

    // Rebuild full link graph for consistency
    index.links.clear();
    for m in index.files.values_mut() {
        m.linked_from.clear();
    }
    let mut files = index.files.clone();
    resolve_links(&mut files, &mut index.links);
    index.files = files;
    index.tags = build_tag_index(&index.files);

    save_index(workspace, &index)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    fn setup_tmp() -> (tempfile::TempDir, String) {
        let dir = tempfile::tempdir().unwrap();
        let d = dir.path().to_string_lossy().to_string();
        (dir, d)
    }

    fn write_file(dir: &str, name: &str, content: &str) {
        let path = format!("{}/{}", dir, name);
        if let Some(parent) = Path::new(&path).parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut f = fs::File::create(&path).unwrap();
        f.write_all(content.as_bytes()).unwrap();
    }

    #[test]
    fn full_scan_basic() {
        let (_dir, d) = setup_tmp();
        write_file(
            &d,
            "note1.md",
            "---\ntitle: 笔记一\ntags: [日记]\n---\n\n# 笔记一\n\n链接到 [[笔记二]]",
        );
        write_file(&d, "note2.md", "# 笔记二\n\n#tag1 内容");
        write_file(&d, ".hidden/ignored.md", "[[笔记一]]");

        let index = full_scan(&d).unwrap();
        assert_eq!(index.files.len(), 2);
        assert_eq!(index.files.get("note1.md").unwrap().title, "笔记一");
        assert_eq!(index.files.get("note2.md").unwrap().title, "笔记二");
        // .hidden directory should be skipped
        assert!(!index.files.contains_key("ignored.md"));
    }

    #[test]
    fn link_resolution() {
        let (_dir, d) = setup_tmp();
        write_file(&d, "a.md", "---\ntitle: Article A\n---\n\n[[Article B]]");
        write_file(&d, "b.md", "---\ntitle: Article B\n---\n\n# B");

        let index = full_scan(&d).unwrap();
        assert_eq!(index.links.len(), 1);
        let link = &index.links[0];
        assert!(link.resolved);
        assert_eq!(link.source, "a.md");
        assert_eq!(link.target, "Article B");
        assert_eq!(link.target_path.as_deref(), Some("b.md"));
    }

    #[test]
    fn backlink_population() {
        let (_dir, d) = setup_tmp();
        write_file(&d, "a.md", "[[笔记二]]");
        write_file(&d, "b.md", "# 笔记二\n\n内容");

        let index = full_scan(&d).unwrap();
        let b = index.files.get("b.md").unwrap();
        assert!(b.linked_from.contains(&"a.md".to_string()));
    }

    #[test]
    fn tag_index() {
        let (_dir, d) = setup_tmp();
        write_file(&d, "a.md", "#tag1 #tag2");
        write_file(&d, "b.md", "#tag1");

        let index = full_scan(&d).unwrap();
        assert_eq!(index.tags.get("tag1").unwrap().len(), 2);
        assert_eq!(index.tags.get("tag2").unwrap().len(), 1);
    }

    #[test]
    fn save_and_load() {
        let (_dir, d) = setup_tmp();
        write_file(&d, "test.md", "# Hello");

        let index = full_scan(&d).unwrap();
        save_index(&d, &index).unwrap();

        let loaded = load_index(&d).unwrap();
        assert_eq!(loaded.files.len(), 1);
        assert!(loaded.files.contains_key("test.md"));
    }

    #[test]
    fn reindex_add_file() {
        let (_dir, d) = setup_tmp();
        write_file(&d, "a.md", "# A");
        full_scan(&d).unwrap();
        save_index(&d, &full_scan(&d).unwrap()).unwrap();

        // Add new file
        write_file(&d, "b.md", "# B\n#tag");
        reindex_file(&d, &format!("{}/b.md", d)).unwrap();

        let loaded = load_index(&d).unwrap();
        assert_eq!(loaded.files.len(), 2);
        assert!(loaded.tags.contains_key("tag"));
    }

    #[test]
    fn reindex_delete_file() {
        let (_dir, d) = setup_tmp();
        write_file(&d, "a.md", "# A");
        write_file(&d, "b.md", "# B\n[[A]]");
        let index = full_scan(&d).unwrap();
        save_index(&d, &index).unwrap();

        // Delete b.md
        fs::remove_file(format!("{}/b.md", d)).unwrap();
        reindex_file(&d, &format!("{}/b.md", d)).unwrap();

        let loaded = load_index(&d).unwrap();
        assert_eq!(loaded.files.len(), 1);
        assert!(loaded.links.is_empty());
    }

    #[test]
    fn empty_directory() {
        let (_dir, d) = setup_tmp();
        let index = full_scan(&d).unwrap();
        assert!(index.files.is_empty());
        assert!(index.links.is_empty());
        assert!(index.tags.is_empty());
    }

    #[test]
    fn nested_directories() {
        let (_dir, d) = setup_tmp();
        write_file(&d, "sub/note.md", "# 嵌套笔记");
        write_file(&d, "root.md", "# 根笔记");

        let index = full_scan(&d).unwrap();
        assert_eq!(index.files.len(), 2);
        assert!(index.files.contains_key("sub/note.md"));
        assert!(index.files.contains_key("root.md"));
    }
}
