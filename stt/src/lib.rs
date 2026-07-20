//! gb-stt: speech-recognition blackbox. Outsiders read CONTRACT.md + schema/ only.

use base64::Engine as _;
use serde_json::{json, Value};
use std::sync::OnceLock;

static CHUNK_SCHEMA: &str = include_str!("../schema/audio-chunk.json");
static EVT_SCHEMA: &str = include_str!("../schema/transcript-event.json");

fn validator(raw: &'static str, cell: &'static OnceLock<jsonschema::Validator>) -> &'static jsonschema::Validator {
    cell.get_or_init(|| {
        jsonschema::validator_for(&serde_json::from_str(raw).expect("schema is valid JSON"))
            .expect("schema compiles")
    })
}

static CHUNK_V: OnceLock<jsonschema::Validator> = OnceLock::new();
static EVT_V: OnceLock<jsonschema::Validator> = OnceLock::new();

#[derive(Debug)]
pub enum SttError {
    InvalidChunk(String),
}

impl std::fmt::Display for SttError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SttError::InvalidChunk(m) => write!(f, "invalid chunk: {m}"),
        }
    }
}

impl std::error::Error for SttError {}

/// One recognition session. Deterministic stand-in engine for now: it reports
/// how much audio it has heard. The seam for a real streaming recognizer
/// (sherpa-onnx Nemotron) is this same push/finish surface.
pub struct Session {
    samples: u64,
    sample_rate: u32,
}

pub fn new_session() -> Session {
    Session { samples: 0, sample_rate: 16000 }
}

impl Session {
    fn heard_ms(&self) -> u64 {
        self.samples * 1000 / u64::from(self.sample_rate.max(1))
    }

    /// Feed one audio chunk envelope (`schema/audio-chunk.json`).
    /// Returns transcript events (`schema/transcript-event.json`); an invalid
    /// chunk changes nothing and returns `InvalidChunk` (fail closed).
    pub fn push(&mut self, chunk: &Value) -> Result<Vec<Value>, SttError> {
        validator(CHUNK_SCHEMA, &CHUNK_V)
            .validate(chunk)
            .map_err(|e| SttError::InvalidChunk(e.to_string()))?;
        let data = base64::engine::general_purpose::STANDARD
            .decode(chunk["dataBase64"].as_str().unwrap_or(""))
            .map_err(|e| SttError::InvalidChunk(format!("dataBase64: {e}")))?;
        if data.len() % 2 != 0 {
            return Err(SttError::InvalidChunk("odd byte count for 16-bit PCM".into()));
        }
        self.sample_rate = chunk["sampleRate"].as_u64().unwrap_or(16000) as u32;
        self.samples += (data.len() / 2) as u64;

        let event = json!({"type": "partial", "text": format!("heard {}ms", self.heard_ms())});
        debug_assert!(validator(EVT_SCHEMA, &EVT_V).is_valid(&event));
        Ok(vec![event])
    }

    /// End the utterance: emits the final transcript event and resets the session.
    pub fn finish(&mut self) -> Vec<Value> {
        let event = json!({"type": "final", "text": format!("heard {}ms total", self.heard_ms())});
        debug_assert!(validator(EVT_SCHEMA, &EVT_V).is_valid(&event));
        self.samples = 0;
        vec![event]
    }
}
