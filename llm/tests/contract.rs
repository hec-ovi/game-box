use futures::StreamExt;
use serde_json::{json, Value};
use std::sync::Mutex;

// Engine selection reads GAME_BOX_LLM_UPSTREAM; serialize tests that depend on it.
static ENV_LOCK: Mutex<()> = Mutex::new(());

fn event_validator() -> jsonschema::Validator {
    let schema: Value =
        serde_json::from_str(include_str!("../schema/token-event.json")).unwrap();
    jsonschema::validator_for(&schema).unwrap()
}

async fn collect(request: Value) -> Vec<Value> {
    let stream = gb_llm::generate(request).await.expect("stream");
    stream.collect().await
}

#[tokio::test]
async fn standin_streams_tokens_and_one_done() {
    let _guard = ENV_LOCK.lock().unwrap();
    std::env::remove_var("GAME_BOX_LLM_UPSTREAM");
    let events = collect(json!({
        "messages": [
            {"role": "system", "content": "npc"},
            {"role": "user", "content": "hello there"}
        ]
    }))
    .await;

    let validator = event_validator();
    for e in &events {
        assert!(validator.is_valid(e), "event off-contract: {e}");
    }
    let text: String = events
        .iter()
        .filter(|e| e["type"] == "token")
        .map(|e| e["text"].as_str().unwrap())
        .collect();
    assert_eq!(text, "You said: hello there");
    let dones: Vec<_> = events.iter().filter(|e| e["type"] == "done").collect();
    assert_eq!(dones.len(), 1);
    assert_eq!(dones[0]["finishReason"], "stop");
    assert_eq!(events.last().unwrap()["type"], "done");
}

#[tokio::test]
async fn invalid_request_is_rejected_before_streaming() {
    let _guard = ENV_LOCK.lock().unwrap();
    std::env::remove_var("GAME_BOX_LLM_UPSTREAM");
    for bad in [
        json!({}),
        json!({"messages": []}),
        json!({"messages": [{"role": "wizard", "content": "hi"}]}),
        json!({"messages": [{"role": "user", "content": "hi"}], "extra": true}),
    ] {
        match gb_llm::generate(bad.clone()).await {
            Err(gb_llm::LlmError::InvalidRequest(_)) => {}
            Err(other) => panic!("expected InvalidRequest for {bad}, got {other:?}"),
            Ok(_) => panic!("expected InvalidRequest for {bad}, got a stream"),
        }
    }
}

#[tokio::test]
async fn upstream_engine_parses_openai_sse() {
    use axum::response::sse::{Event, Sse};
    use axum::{routing::post, Router};
    use futures::stream;

    // Mock OpenAI-compatible upstream emitting two deltas then [DONE].
    let app = Router::new().route(
        "/v1/chat/completions",
        post(|| async {
            let events = vec![
                Ok::<_, std::convert::Infallible>(
                    Event::default()
                        .data(r#"{"choices":[{"index":0,"delta":{"content":"Hel"},"finish_reason":null}]}"#),
                ),
                Ok(Event::default()
                    .data(r#"{"choices":[{"index":0,"delta":{"content":"lo"},"finish_reason":null}]}"#)),
                Ok(Event::default()
                    .data(r#"{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}"#)),
                Ok(Event::default().data("[DONE]")),
            ];
            Sse::new(stream::iter(events))
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });

    let _guard = ENV_LOCK.lock().unwrap();
    std::env::set_var("GAME_BOX_LLM_UPSTREAM", format!("http://{addr}"));
    let events = collect(json!({"messages": [{"role": "user", "content": "hi"}]})).await;
    std::env::remove_var("GAME_BOX_LLM_UPSTREAM");

    let validator = event_validator();
    for e in &events {
        assert!(validator.is_valid(e), "event off-contract: {e}");
    }
    let text: String = events
        .iter()
        .filter(|e| e["type"] == "token")
        .map(|e| e["text"].as_str().unwrap())
        .collect();
    assert_eq!(text, "Hello");
    assert_eq!(events.last().unwrap(), &json!({"type": "done", "finishReason": "stop"}));
}
