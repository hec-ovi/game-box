//! Compiled validators for this box's two schemas.

use std::sync::OnceLock;

static ENTRY_SCHEMA: &str = include_str!("../schema/model-entry.json");
static RESOLVED_SCHEMA: &str = include_str!("../schema/resolved-model.json");

static ENTRY_V: OnceLock<jsonschema::Validator> = OnceLock::new();
static RESOLVED_V: OnceLock<jsonschema::Validator> = OnceLock::new();

fn compile(raw: &str, cell: &'static OnceLock<jsonschema::Validator>) -> &'static jsonschema::Validator {
    cell.get_or_init(|| {
        jsonschema::validator_for(&serde_json::from_str(raw).expect("schema is valid JSON"))
            .expect("schema compiles")
    })
}

pub fn entry() -> &'static jsonschema::Validator {
    compile(ENTRY_SCHEMA, &ENTRY_V)
}

pub fn resolved() -> &'static jsonschema::Validator {
    compile(RESOLVED_SCHEMA, &RESOLVED_V)
}
