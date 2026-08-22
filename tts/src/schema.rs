//! Compiled validators for this box's two schemas.

use std::sync::OnceLock;

static REQUEST_SCHEMA: &str = include_str!("../schema/speak-request.json");
static EVENT_SCHEMA: &str = include_str!("../schema/audio-event.json");

static REQUEST_V: OnceLock<jsonschema::Validator> = OnceLock::new();
static EVENT_V: OnceLock<jsonschema::Validator> = OnceLock::new();

fn compile(raw: &str, cell: &'static OnceLock<jsonschema::Validator>) -> &'static jsonschema::Validator {
    cell.get_or_init(|| {
        jsonschema::validator_for(&serde_json::from_str(raw).expect("schema is valid JSON"))
            .expect("schema compiles")
    })
}

pub fn request() -> &'static jsonschema::Validator {
    compile(REQUEST_SCHEMA, &REQUEST_V)
}

pub fn event() -> &'static jsonschema::Validator {
    compile(EVENT_SCHEMA, &EVENT_V)
}
