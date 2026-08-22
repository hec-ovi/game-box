//! Where cached model files live. `GAME_BOX_MODELS_DIR` wins; otherwise the
//! platform cache directory, under `game-box/models`.

use std::path::PathBuf;

pub fn default_root() -> PathBuf {
    if let Some(dir) = env_path("GAME_BOX_MODELS_DIR") {
        return dir;
    }
    let base = env_path("XDG_CACHE_HOME")
        .or_else(|| env_path("LOCALAPPDATA"))
        .or_else(|| env_path("HOME").map(|h| h.join(".cache")))
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("game-box").join("models")
}

fn env_path(key: &str) -> Option<PathBuf> {
    std::env::var_os(key).filter(|v| !v.is_empty()).map(PathBuf::from)
}
