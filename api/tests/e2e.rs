use futures::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tokio_tungstenite::tungstenite::Message;

async fn spawn_server() -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, gb_api::app()).await.unwrap() });
    format!("{addr}")
}

fn validator(schema_src: &str) -> jsonschema::Validator {
    jsonschema::validator_for(&serde_json::from_str(schema_src).unwrap()).unwrap()
}

#[tokio::test]
async fn health_reports_ok() {
    let addr = spawn_server().await;
    let body: Value = reqwest::get(format!("http://{addr}/health")).await.unwrap().json().await.unwrap();
    assert_eq!(body["status"], "ok");
    assert_eq!(body["service"], "game-box");
}

#[tokio::test]
async fn chat_non_streaming_returns_full_completion() {
    let addr = spawn_server().await;
    let resp = reqwest::Client::new()
        .post(format!("http://{addr}/v1/chat/completions"))
        .json(&json!({"messages": [{"role": "user", "content": "open the gate"}]}))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: Value = resp.json().await.unwrap();
    assert!(
        validator(include_str!("../schema/chat-response.json")).is_valid(&body),
        "response off-contract: {body}"
    );
    assert_eq!(body["choices"][0]["message"]["content"], "You said: open the gate");
    assert_eq!(body["choices"][0]["finish_reason"], "stop");
}

#[tokio::test]
async fn chat_streaming_emits_sse_chunks_then_done() {
    let addr = spawn_server().await;
    let resp = reqwest::Client::new()
        .post(format!("http://{addr}/v1/chat/completions"))
        .json(&json!({"stream": true, "messages": [{"role": "user", "content": "hi"}]}))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let content_type = resp.headers()["content-type"].to_str().unwrap().to_string();
    assert!(content_type.starts_with("text/event-stream"), "got {content_type}");

    let text = resp.text().await.unwrap();
    let datas: Vec<&str> = text
        .lines()
        .filter_map(|l| l.strip_prefix("data: "))
        .collect();
    assert_eq!(*datas.last().unwrap(), "[DONE]");

    let chunk_validator = validator(include_str!("../schema/chat-stream-event.json"));
    let mut streamed = String::new();
    let mut finish: Option<Value> = None;
    for data in &datas[..datas.len() - 1] {
        let chunk: Value = serde_json::from_str(data).unwrap();
        assert!(chunk_validator.is_valid(&chunk), "chunk off-contract: {chunk}");
        if let Some(t) = chunk["choices"][0]["delta"]["content"].as_str() {
            streamed.push_str(t);
        }
        if !chunk["choices"][0]["finish_reason"].is_null() {
            finish = Some(chunk["choices"][0]["finish_reason"].clone());
        }
    }
    assert_eq!(streamed, "You said: hi");
    assert_eq!(finish, Some(json!("stop")));
}

#[tokio::test]
async fn chat_invalid_body_gets_contract_error() {
    let addr = spawn_server().await;
    let error_validator = validator(include_str!("../schema/error.json"));

    for (body, expect_status) in [
        ("not json at all".to_string(), 400),
        (json!({"messages": []}).to_string(), 400),
        (json!({"messages": [{"role": "user", "content": "hi"}], "max_tokens": 5}).to_string(), 400),
    ] {
        let resp = reqwest::Client::new()
            .post(format!("http://{addr}/v1/chat/completions"))
            .header("content-type", "application/json")
            .body(body.clone())
            .send()
            .await
            .unwrap();
        assert_eq!(resp.status(), expect_status, "body: {body}");
        let err: Value = resp.json().await.unwrap();
        assert!(error_validator.is_valid(&err), "error off-contract: {err}");
        assert_eq!(err["error"]["type"], "invalid_request_error");
    }
}

fn append_event(ms: u64, rate: u64) -> String {
    use base64::Engine as _;
    let bytes = vec![0u8; ((ms * rate / 1000) * 2) as usize];
    json!({
        "type": "input_audio_buffer.append",
        "audio": {
            "mediaType": "audio/pcm;bits=16",
            "sampleRate": rate,
            "dataBase64": base64::engine::general_purpose::STANDARD.encode(bytes)
        }
    })
    .to_string()
}

async fn next_json(
    ws: &mut (impl StreamExt<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin),
) -> Value {
    loop {
        match ws.next().await.expect("socket open").expect("frame ok") {
            Message::Text(t) => return serde_json::from_str(&t).unwrap(),
            _ => continue,
        }
    }
}

#[tokio::test]
async fn realtime_streams_partials_final_and_survives_bad_input() {
    let addr = spawn_server().await;
    let (mut ws, _) = tokio_tungstenite::connect_async(format!("ws://{addr}/v1/realtime"))
        .await
        .unwrap();
    let server_validator = validator(include_str!("../schema/realtime-server-event.json"));

    ws.send(Message::Text(append_event(1000, 16000).into())).await.unwrap();
    let partial = next_json(&mut ws).await;
    assert!(server_validator.is_valid(&partial));
    assert_eq!(partial, json!({"type": "transcription.partial", "text": "heard 1000ms"}));

    // invalid envelope: error event, session untouched
    ws.send(Message::Text(
        json!({"type": "input_audio_buffer.append", "audio": {"mediaType": "audio/ogg"}}).to_string().into(),
    ))
    .await
    .unwrap();
    let error = next_json(&mut ws).await;
    assert!(server_validator.is_valid(&error));
    assert_eq!(error["type"], "error");
    assert_eq!(error["error"]["type"], "invalid_request_error");

    ws.send(Message::Text(append_event(500, 16000).into())).await.unwrap();
    let partial2 = next_json(&mut ws).await;
    assert_eq!(partial2["text"], "heard 1500ms");

    ws.send(Message::Text(json!({"type": "input_audio_buffer.commit"}).to_string().into()))
        .await
        .unwrap();
    let done = next_json(&mut ws).await;
    assert!(server_validator.is_valid(&done));
    assert_eq!(done, json!({"type": "transcription.completed", "text": "heard 1500ms total"}));
}
