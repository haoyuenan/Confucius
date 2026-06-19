pub mod types;
pub mod parser;
pub mod indexer;
pub mod resolver;

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
