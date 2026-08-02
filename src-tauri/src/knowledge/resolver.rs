use crate::knowledge::types::*;
use std::collections::{HashMap, HashSet};

pub fn get_backlinks(index: &KnowledgeIndex, file_path: &str) -> Vec<Link> {
    index
        .links
        .iter()
        .filter(|l| l.target_path.as_deref() == Some(file_path))
        .cloned()
        .collect()
}

pub fn get_graph_data(
    index: &KnowledgeIndex,
    file_path: Option<&str>,
) -> (Vec<String>, Vec<Link>) {
    if let Some(fp) = file_path {
        let mut connected = HashSet::new();
        connected.insert(fp.to_string());
        let links: Vec<Link> = index
            .links
            .iter()
            .filter(|l| l.source == fp || l.target_path.as_deref() == Some(fp))
            .cloned()
            .collect();
        for l in &links {
            connected.insert(l.source.clone());
            if let Some(ref tp) = l.target_path {
                connected.insert(tp.clone());
            }
        }
        (connected.into_iter().collect(), links)
    } else {
        (
            index.files.keys().cloned().collect(),
            index.links.clone(),
        )
    }
}

pub fn get_tags(index: &KnowledgeIndex) -> HashMap<String, Vec<String>> {
    index.tags.clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn make_index() -> KnowledgeIndex {
        let mut files = HashMap::new();
        files.insert(
            "a.md".into(),
            FileMeta {
                path: "a.md".into(),
                title: "笔记A".into(),
                links: vec!["笔记B".into()],
                linked_from: vec![],
                tags: vec!["tag1".into()],
                created: "".into(),
                modified: "".into(),
            },
        );
        files.insert(
            "b.md".into(),
            FileMeta {
                path: "b.md".into(),
                title: "笔记B".into(),
                links: vec![],
                linked_from: vec!["a.md".into()],
                tags: vec!["tag1".into(), "tag2".into()],
                created: "".into(),
                modified: "".into(),
            },
        );
        let links = vec![Link {
            source: "a.md".into(),
            target: "笔记B".into(),
            resolved: true,
            target_path: Some("b.md".into()),
        }];
        let mut tags = HashMap::new();
        tags.insert("tag1".into(), vec!["a.md".into(), "b.md".into()]);
        tags.insert("tag2".into(), vec!["b.md".into()]);

        KnowledgeIndex {
            version: 1,
            files,
            links,
            tags,
        }
    }

    #[test]
    fn backlinks_work() {
        let idx = make_index();
        let bl = get_backlinks(&idx, "b.md");
        assert_eq!(bl.len(), 1);
        assert_eq!(bl[0].source, "a.md");
    }

    #[test]
    fn backlinks_empty_for_unlinked() {
        let idx = make_index();
        let bl = get_backlinks(&idx, "a.md");
        assert!(bl.is_empty());
    }

    #[test]
    fn global_graph() {
        let idx = make_index();
        let (nodes, links) = get_graph_data(&idx, None);
        assert_eq!(nodes.len(), 2);
        assert_eq!(links.len(), 1);
    }

    #[test]
    fn local_graph() {
        let idx = make_index();
        let (nodes, links) = get_graph_data(&idx, Some("a.md"));
        assert_eq!(nodes.len(), 2);
        assert_eq!(links.len(), 1);
    }

    #[test]
    fn get_tags_works() {
        let idx = make_index();
        let tags = get_tags(&idx);
        assert_eq!(tags.len(), 2);
        assert_eq!(tags.get("tag1").unwrap().len(), 2);
    }
}
