use tantivy::schema::*;

pub fn build_schema() -> Schema {
    let mut builder = Schema::builder();
    builder.add_text_field("file_path", STRING | STORED);
    builder.add_text_field("file_name", STRING | STORED);
    builder.add_text_field("content", TEXT);
    builder.add_text_field("title", TEXT | STORED);
    builder.add_text_field("tags", STRING | STORED);
    builder.add_text_field("modified", STRING | STORED);
    builder.build()
}

pub struct SearchFields {
    pub file_path: Field,
    pub file_name: Field,
    pub content: Field,
    pub title: Field,
    pub tags: Field,
    pub modified: Field,
}

pub fn get_fields(schema: &Schema) -> SearchFields {
    SearchFields {
        file_path: schema.get_field("file_path").unwrap(),
        file_name: schema.get_field("file_name").unwrap(),
        content: schema.get_field("content").unwrap(),
        title: schema.get_field("title").unwrap(),
        tags: schema.get_field("tags").unwrap(),
        modified: schema.get_field("modified").unwrap(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_schema_exposes_all_expected_fields() {
        let schema = build_schema();
        for name in ["file_path", "file_name", "content", "title", "tags", "modified"] {
            assert!(schema.get_field(name).is_ok(), "缺少字段: {}", name);
        }
    }

    #[test]
    fn get_fields_does_not_panic_and_fields_are_distinct() {
        let schema = build_schema();
        let f = get_fields(&schema);
        // 六个字段应互不相同
        let all = [f.file_path, f.file_name, f.content, f.title, f.tags, f.modified];
        for i in 0..all.len() {
            for j in (i + 1)..all.len() {
                assert_ne!(all[i], all[j], "字段 {} 与 {} 重复", i, j);
            }
        }
    }
}

