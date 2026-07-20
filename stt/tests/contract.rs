use base64::Engine as _;
use serde_json::{json, Value};

fn chunk_of_ms(ms: u64, rate: u64) -> Value {
    let samples = ms * rate / 1000;
    let bytes = vec![0u8; (samples * 2) as usize];
    json!({
        "mediaType": "audio/pcm;bits=16",
        "sampleRate": rate,
        "dataBase64": base64::engine::general_purpose::STANDARD.encode(bytes)
    })
}

fn event_validator() -> jsonschema::Validator {
    let schema: Value =
        serde_json::from_str(include_str!("../schema/transcript-event.json")).unwrap();
    jsonschema::validator_for(&schema).unwrap()
}

#[test]
fn streams_partials_then_final_and_resets() {
    let validator = event_validator();
    let mut session = gb_stt::new_session();

    let e1 = session.push(&chunk_of_ms(1000, 16000)).unwrap();
    assert_eq!(e1, vec![json!({"type": "partial", "text": "heard 1000ms"})]);
    let e2 = session.push(&chunk_of_ms(500, 16000)).unwrap();
    assert_eq!(e2, vec![json!({"type": "partial", "text": "heard 1500ms"})]);
    let done = session.finish();
    assert_eq!(done, vec![json!({"type": "final", "text": "heard 1500ms total"})]);
    for e in e1.iter().chain(e2.iter()).chain(done.iter()) {
        assert!(validator.is_valid(e), "event off-contract: {e}");
    }

    // finish resets the utterance
    let e3 = session.push(&chunk_of_ms(200, 16000)).unwrap();
    assert_eq!(e3, vec![json!({"type": "partial", "text": "heard 200ms"})]);
}

#[test]
fn invalid_chunks_fail_closed_without_mutating() {
    let mut session = gb_stt::new_session();
    session.push(&chunk_of_ms(1000, 16000)).unwrap();

    for bad in [
        json!({}),
        json!({"mediaType": "audio/ogg", "sampleRate": 16000, "dataBase64": "AAAA"}),
        json!({"mediaType": "audio/pcm;bits=16", "sampleRate": 4000, "dataBase64": "AAAA"}),
        json!({"mediaType": "audio/pcm;bits=16", "sampleRate": 16000, "dataBase64": "not base64!!"}),
        json!({"mediaType": "audio/pcm;bits=16", "sampleRate": 16000, "dataBase64": "AAAA", "extra": 1}),
    ] {
        assert!(
            matches!(session.push(&bad), Err(gb_stt::SttError::InvalidChunk(_))),
            "expected InvalidChunk for {bad}"
        );
    }

    // state untouched by the failed pushes
    let done = session.finish();
    assert_eq!(done[0]["text"], "heard 1000ms total");
}
