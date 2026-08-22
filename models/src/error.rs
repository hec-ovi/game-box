//! The closed error set of gb-models.

use std::path::PathBuf;

#[derive(Debug)]
pub enum ModelsError {
    /// Catalog entry failed schema validation. Nothing is read from disk.
    InvalidEntry(String),
    /// The file is not in the cache yet. Carries where it is expected.
    Missing(PathBuf),
    /// The cached file's digest does not match the entry.
    Integrity { expected: String, actual: String },
    /// The cached file could not be read.
    Unreadable(String),
}

impl std::fmt::Display for ModelsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ModelsError::InvalidEntry(m) => write!(f, "invalid model entry: {m}"),
            ModelsError::Missing(p) => write!(f, "model not cached: {}", p.display()),
            ModelsError::Integrity { expected, actual } => {
                write!(f, "sha256 mismatch: expected {expected}, found {actual}")
            }
            ModelsError::Unreadable(m) => write!(f, "cached model unreadable: {m}"),
        }
    }
}

impl std::error::Error for ModelsError {}
