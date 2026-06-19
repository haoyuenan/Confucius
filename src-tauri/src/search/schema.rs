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
