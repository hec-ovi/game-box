//! Tests that point the engine at a real upstream. They set
//! GAME_BOX_LLM_UPSTREAM, which is process-wide, so they live in their own test
//! binary rather than racing the tests that expect the stand-in.

use serde_json::{json, Value};

async fn spawn_server() -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, gb_api::app()).await.unwrap() });
    format!("{addr}")
}

fn validator(schema_src: &str) -> jsonschema::Validator {
    jsonschema::validator_for(&serde_json::from_str(schema_src).unwrap()).unwrap()
}

/// An engine that says something and calls a tool in the same reply, which is
/// what a real model does when an NPC talks and acts at once.
async fn speaking_and_acting_upstream() -> String {
    use axum::response::sse::{Event, Sse};
    use axum::{routing::post, Router};
    use futures::stream;

    let app = Router::new().route(
        "/v1/chat/completions",
        post(|| async {
            let events = vec![
                Ok::<Event, std::convert::Infallible>(Event::default().data(
                    r#"{"choices":[{"index":0,"delta":{"content":"Take the ledger to Mara."},"finish_reason":null}]}"#,
                )),
                Ok(Event::default().data(
                    r#"{"choices":[{"index":0,"delta":{"tool_calls":[{"id":"c1","type":"function","function":{"name":"give_quest","arguments":"{\"questId\":\"quest_0001\"}"}}]},"finish_reason":null}]}"#,
                )),
                Ok(Event::default().data(r#"{"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}"#)),
            ];
            Sse::new(stream::iter(events))
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{addr}")
}

#[tokio::test]
async fn a_speaker_keeps_both_what_they_said_and_what_they_did() {
    let base = speaking_and_acting_upstream().await;
    let addr = spawn_server().await;
    std::env::set_var("GAME_BOX_LLM_UPSTREAM", &base);

    let body: Value = reqwest::Client::new()
        .post(format!("http://{addr}/v1/chat/completions"))
        .json(&json!({
            "messages": [{"role": "user", "content": "anything going on?"}],
            "tools": [{
                "type": "function",
                "function": {
                    "name": "give_quest",
                    "parameters": {"type": "object", "properties": {"questId": {"type": "string"}}, "required": ["questId"]}
                }
            }],
            "tool_choice": "auto"
        }))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    std::env::remove_var("GAME_BOX_LLM_UPSTREAM");

    assert!(
        validator(include_str!("../schema/chat-response.json")).is_valid(&body),
        "response off-contract: {body}"
    );
    let choice = &body["choices"][0];
    assert_eq!(choice["finish_reason"], "tool_calls");
    assert_eq!(choice["message"]["content"], "Take the ledger to Mara.");
    assert_eq!(choice["message"]["tool_calls"][0]["function"]["name"], "give_quest");
}
