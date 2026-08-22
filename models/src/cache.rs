//! The model cache: one directory of files, each identified by its sha256.

use crate::digest::sha256_of;
use crate::error::ModelsError;
use crate::root::default_root;
use crate::schema;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

pub struct Cache {
    root: PathBuf,
}

impl Cache {
    /// Cache at `GAME_BOX_MODELS_DIR`, or the platform cache directory.
    pub fn open() -> Self {
        Cache { root: default_root() }
    }

    /// Cache at an explicit directory.
    pub fn at(root: impl Into<PathBuf>) -> Self {
        Cache { root: root.into() }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    /// Locate a catalog entry (`schema/model-entry.json`) and verify its digest.
    /// Returns a resolved model (`schema/resolved-model.json`).
    pub fn resolve(&self, entry: &Value) -> Result<Value, ModelsError> {
        schema::entry()
            .validate(entry)
            .map_err(|e| ModelsError::InvalidEntry(e.to_string()))?;
        let expected = entry["sha256"].as_str().unwrap_or_default().to_string();
        let path = self.root.join(entry["file"].as_str().unwrap_or_default());
        if !path.is_file() {
            return Err(ModelsError::Missing(path));
        }
        let (actual, size) = sha256_of(&path).map_err(|e| ModelsError::Unreadable(e.to_string()))?;
        if actual != expected {
            return Err(ModelsError::Integrity { expected, actual });
        }
        let resolved = json!({
            "id": entry["id"],
            "path": path.to_string_lossy(),
            "sizeBytes": size,
            "sha256": actual
        });
        debug_assert!(schema::resolved().is_valid(&resolved), "resolved off-contract: {resolved}");
        Ok(resolved)
    }
}
