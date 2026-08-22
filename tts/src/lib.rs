//! gb-tts: speech-synthesis blackbox. Outsiders read CONTRACT.md + schema/ only.

mod error;
mod frame;
mod schema;
mod session;
mod voice;

pub use error::TtsError;
pub use session::Session;

use serde_json::Value;

/// Mimi codec native rate, what the streaming engine produces.
const DEFAULT_SAMPLE_RATE: u32 = 24000;

/// Open a speaking session (`schema/speak-request.json`).
pub fn new_session(request: &Value) -> Result<Session, TtsError> {
    schema::request()
        .validate(request)
        .map_err(|e| TtsError::InvalidRequest(e.to_string()))?;
    let requested = request["voice"].as_str().unwrap_or_default();
    if !voice::is_known(requested) {
        return Err(TtsError::UnknownVoice(requested.to_string()));
    }
    let sample_rate = request["sampleRate"].as_u64().unwrap_or(u64::from(DEFAULT_SAMPLE_RATE)) as u32;
    let speed = request["speed"].as_f64().unwrap_or(1.0);
    Ok(Session::new(sample_rate, speed))
}

/// Voices `new_session` accepts.
pub fn voices() -> &'static [&'static str] {
    voice::all()
}
