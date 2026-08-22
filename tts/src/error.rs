//! The closed error set of gb-tts.

#[derive(Debug)]
pub enum TtsError {
    /// Speak request failed schema validation. No session is created.
    InvalidRequest(String),
    /// Voice id is not one the loaded engine can speak. No session is created.
    UnknownVoice(String),
}

impl std::fmt::Display for TtsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TtsError::InvalidRequest(m) => write!(f, "invalid speak request: {m}"),
            TtsError::UnknownVoice(v) => write!(f, "unknown voice: {v}"),
        }
    }
}

impl std::error::Error for TtsError {}
