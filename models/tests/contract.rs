use gb_models::{Cache, ModelsError};
use serde_json::{json, Value};

const HELLO_SHA256: &str = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

fn resolved_validator() -> jsonschema::Validator {
    let schema: Value = serde_json::from_str(include_str!("../schema/resolved-model.json")).unwrap();
    jsonschema::validator_for(&schema).unwrap()
}

fn entry(sha: &str) -> Value {
    json!({"id": "qwen3-4b", "file": "qwen3-4b.bin", "sha256": sha})
}

#[test]
fn resolves_a_cached_file_and_reports_it_on_contract() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("qwen3-4b.bin"), b"hello").unwrap();
    let cache = Cache::at(dir.path());

    let resolved = cache.resolve(&entry(HELLO_SHA256)).unwrap();
    assert!(resolved_validator().is_valid(&resolved), "off-contract: {resolved}");
    assert_eq!(resolved["id"], "qwen3-4b");
    assert_eq!(resolved["sizeBytes"], 5);
    assert_eq!(resolved["path"], dir.path().join("qwen3-4b.bin").to_string_lossy().as_ref());
}

#[test]
fn missing_corrupt_and_malformed_entries_fail_closed() {
    let dir = tempfile::tempdir().unwrap();
    let cache = Cache::at(dir.path());

    let missing = cache.resolve(&entry(HELLO_SHA256));
    assert!(matches!(missing, Err(ModelsError::Missing(p)) if p == dir.path().join("qwen3-4b.bin")));

    std::fs::write(dir.path().join("qwen3-4b.bin"), b"tampered").unwrap();
    assert!(matches!(
        cache.resolve(&entry(HELLO_SHA256)),
        Err(ModelsError::Integrity { .. })
    ));

    for bad in [
        json!({}),
        json!({"id": "x", "file": "../escape.bin", "sha256": HELLO_SHA256}),
        json!({"id": "x", "file": "x.bin", "sha256": "not-a-digest"}),
        json!({"id": "x", "file": "x.bin", "sha256": HELLO_SHA256, "extra": 1}),
    ] {
        assert!(
            matches!(cache.resolve(&bad), Err(ModelsError::InvalidEntry(_))),
            "expected InvalidEntry for {bad}"
        );
    }
}

#[test]
fn cache_root_follows_the_env_override() {
    std::env::set_var("GAME_BOX_MODELS_DIR", "/opt/game-box-models");
    assert_eq!(Cache::open().root(), std::path::Path::new("/opt/game-box-models"));
    std::env::remove_var("GAME_BOX_MODELS_DIR");
}
