use base64::Engine as _;
use serde_json::{json, Value};

fn event_validator() -> jsonschema::Validator {
    let schema: Value = serde_json::from_str(include_str!("../schema/audio-event.json")).unwrap();
    jsonschema::validator_for(&schema).unwrap()
}

fn frame_ms(event: &Value) -> u64 {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(event["dataBase64"].as_str().unwrap())
        .unwrap();
    (bytes.len() as u64 / 2) * 1000 / event["sampleRate"].as_u64().unwrap()
}

#[test]
fn speaks_mid_sentence_then_ends_once_and_resets() {
    let validator = event_validator();
    let mut session = gb_tts::new_session(&json!({"voice": "narrator"})).unwrap();

    // audio arrives while the sentence is still being written
    let early = session.push_text("Hello there ");
    assert!(!early.is_empty(), "no audio before the sentence closed");
    assert!(early.iter().all(|e| e["type"] == "frame"));
    assert!(early.iter().all(|e| frame_ms(e) == 80), "frames are not 80ms: {early:?}");

    let more = session.push_text("stranger.");
    let done = session.finish();
    assert_eq!(done.iter().filter(|e| e["type"] == "end").count(), 1);
    assert_eq!(done.last().unwrap()["type"], "end");
    let spoken = done.last().unwrap()["durationMs"].as_u64().unwrap();
    assert!(spoken > 0, "end reported no audio");

    for e in early.iter().chain(more.iter()).chain(done.iter()) {
        assert!(validator.is_valid(e), "event off-contract: {e}");
    }

    // finish reset the utterance: the next line is timed on its own
    let next = session.finish();
    assert_eq!(next, vec![json!({"type": "end", "durationMs": 0})]);
}

#[test]
fn bad_requests_and_unknown_voices_fail_closed() {
    for bad in [
        json!({}),
        json!({"voice": ""}),
        json!({"voice": "narrator", "sampleRate": 4000}),
        json!({"voice": "narrator", "speed": 5}),
        json!({"voice": "narrator", "extra": 1}),
    ] {
        assert!(
            matches!(gb_tts::new_session(&bad), Err(gb_tts::TtsError::InvalidRequest(_))),
            "expected InvalidRequest for {bad}"
        );
    }

    assert!(matches!(
        gb_tts::new_session(&json!({"voice": "dragon"})),
        Err(gb_tts::TtsError::UnknownVoice(_))
    ));
    for v in gb_tts::voices() {
        assert!(gb_tts::new_session(&json!({"voice": v})).is_ok(), "voice {v} rejected");
    }
}
