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

/// An upstream that answers with a tool call split across deltas, the way a
/// real engine streams one.
async fn tool_calling_upstream(argument_fragments: Vec<&'static str>, finish_reason: &'static str) -> String {
    use axum::response::sse::{Event, Sse};
    use axum::{routing::post, Router};
    use futures::stream;

    let app = Router::new().route(
        "/v1/chat/completions",
        post(move || async move {
            let mut events = vec![Ok::<Event, std::convert::Infallible>(Event::default().data(
                r#"{"choices":[{"index":0,"delta":{"tool_calls":[{"id":"call_1","type":"function","function":{"name":"name_city","arguments":""}}]},"finish_reason":null}]}"#,
            ))];
            for fragment in argument_fragments {
                let payload = json!({
                    "choices": [{"index": 0, "delta": {"tool_calls": [{"function": {"arguments": fragment}}]}, "finish_reason": null}]
                });
                events.push(Ok(Event::default().data(payload.to_string())));
            }
            let closing = json!({"choices": [{"index": 0, "delta": {}, "finish_reason": finish_reason}]});
            events.push(Ok(Event::default().data(closing.to_string())));
            Sse::new(stream::iter(events))
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{addr}")
}

fn tool_request(base_extra: Value) -> Value {
    let mut request = json!({
        "messages": [{"role": "user", "content": "name a western town"}],
        "tools": [{
            "type": "function",
            "function": {
                "name": "name_city",
                "description": "Name the city",
                "parameters": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]}
            }
        }],
        "tool_choice": {"type": "function", "function": {"name": "name_city"}}
    });
    if let Some(extra) = base_extra.as_object() {
        for (k, v) in extra {
            request[k] = v.clone();
        }
    }
    request
}

#[tokio::test]
async fn upstream_tool_call_arrives_whole_with_parsed_arguments() {
    let base = tool_calling_upstream(vec![r#"{"na"#, r#"me":"Dry "#, r#"Gulch"}"#], "tool_calls").await;

    let _guard = ENV_LOCK.lock().unwrap();
    std::env::set_var("GAME_BOX_LLM_UPSTREAM", &base);
    let events = collect(tool_request(json!({}))).await;
    std::env::remove_var("GAME_BOX_LLM_UPSTREAM");

    let validator = event_validator();
    for e in &events {
        assert!(validator.is_valid(e), "event off-contract: {e}");
    }
    let calls: Vec<_> = events.iter().filter(|e| e["type"] == "tool-call").collect();
    assert_eq!(calls.len(), 1, "a split tool call must arrive as one event");
    assert_eq!(calls[0]["name"], "name_city");
    assert_eq!(calls[0]["arguments"], json!({"name": "Dry Gulch"}));
    assert_eq!(calls[0]["id"], "call_1");
    assert_eq!(events.last().unwrap()["finishReason"], "stop");
}

#[tokio::test]
async fn arguments_that_do_not_parse_never_reach_the_caller() {
    let base = tool_calling_upstream(vec![r#"{"name": "Dry Gul"#], "tool_calls").await;

    let _guard = ENV_LOCK.lock().unwrap();
    std::env::set_var("GAME_BOX_LLM_UPSTREAM", &base);
    let events = collect(tool_request(json!({}))).await;
    std::env::remove_var("GAME_BOX_LLM_UPSTREAM");

    assert!(events.iter().all(|e| e["type"] != "tool-call"), "truncated arguments must not be emitted");
    assert_eq!(events.last().unwrap(), &json!({"type": "done", "finishReason": "error"}));
}

#[tokio::test]
async fn standin_makes_the_forced_call_with_no_arguments() {
    let _guard = ENV_LOCK.lock().unwrap();
    std::env::remove_var("GAME_BOX_LLM_UPSTREAM");
    let events = collect(tool_request(json!({}))).await;

    let validator = event_validator();
    for e in &events {
        assert!(validator.is_valid(e), "event off-contract: {e}");
    }
    assert_eq!(events[0], json!({"type": "tool-call", "name": "name_city", "arguments": {}}));
    assert_eq!(events.last().unwrap()["type"], "done");
}
