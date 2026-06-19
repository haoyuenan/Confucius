use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileMeta {
    pub path: String,
    pub title: String,
    pub links: Vec<String>,
    pub linked_from: Vec<String>,
    pub tags: Vec<String>,
    pub created: String,
    pub modified: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Link {
    pub source: String,
    pub target: String,
    pub resolved: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_path: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct KnowledgeIndex {
    pub version: u32,
    pub files: HashMap<String, FileMeta>,
    pub links: Vec<Link>,
    pub tags: HashMap<String, Vec<String>>,
}
