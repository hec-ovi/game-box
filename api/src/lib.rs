//! gb-api: the public surface of game-box. Outsiders (game clients) speak the
//! OpenAI-compatible contract in CONTRACT.md + schema/; internally this layer
//! talks to gb-llm and gb-stt through their contracts only.

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use futures::StreamExt;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

static CHAT_REQ_SCHEMA: &str = include_str!("../schema/chat-request.json");

fn chat_req_validator() -> &'static jsonschema::Validator {
    static V: OnceLock<jsonschema::Validator> = OnceLock::new();
    V.get_or_init(|| {
        jsonschema::validator_for(&serde_json::from_str(CHAT_REQ_SCHEMA).expect("valid JSON"))
            .expect("schema compiles")
    })
}

pub fn app() -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/v1/chat/completions", post(chat))
        .route("/v1/realtime", get(realtime))
}

async fn health() -> Json<Value> {
    Json(json!({"status": "ok", "service": "game-box", "contractVersion": "0.1.0"}))
}

fn error_body(message: &str, error_type: &str) -> Value {
    json!({"error": {"message": message, "type": error_type}})
}

fn now_unix() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn next_id() -> String {
    static N: AtomicU64 = AtomicU64::new(1);
    format!("chatcmpl-gb{}", N.fetch_add(1, Ordering::Relaxed))
}

async fn chat(body: String) -> Response {
    let Ok(request) = serde_json::from_str::<Value>(&body) else {
        return (StatusCode::BAD_REQUEST, Json(error_body("body is not valid JSON", "invalid_request_error")))
            .into_response();
    };
    if let Err(e) = chat_req_validator().validate(&request) {
        return (StatusCode::BAD_REQUEST, Json(error_body(&e.to_string(), "invalid_request_error")))
            .into_response();
    }

    let model = request["model"].as_str().unwrap_or("game-box/standin").to_string();
    let mut llm_request = json!({"messages": request["messages"]});
    if let Some(t) = request.get("temperature") {
        llm_request["temperature"] = t.clone();
    }
    if let Some(m) = request.get("model") {
        llm_request["model"] = m.clone();
    }
    for passthrough in ["tools", "tool_choice"] {
        if let Some(v) = request.get(passthrough) {
            llm_request[passthrough] = v.clone();
        }
    }

    let stream = match gb_llm::generate(llm_request).await {
        Ok(s) => s,
        Err(gb_llm::LlmError::InvalidRequest(m)) => {
            return (StatusCode::BAD_REQUEST, Json(error_body(&m, "invalid_request_error"))).into_response();
        }
        Err(gb_llm::LlmError::Upstream(m)) => {
            return (StatusCode::BAD_GATEWAY, Json(error_body(&m, "server_error"))).into_response();
        }
    };

    let id = next_id();
    let created = now_unix();

    if request["stream"] == json!(true) {
        let sse_stream = stream
            .map(move |evt| {
                let chunk = if evt["type"] == "token" {
                    json!({
                        "id": id, "object": "chat.completion.chunk", "created": created, "model": model,
                        "choices": [{"index": 0, "delta": {"content": evt["text"]}, "finish_reason": null}]
                    })
                } else if evt["type"] == "tool-call" {
                    json!({
                        "id": id, "object": "chat.completion.chunk", "created": created, "model": model,
                        "choices": [{"index": 0, "delta": {"tool_calls": [tool_call(&evt)]}, "finish_reason": null}]
                    })
                } else {
                    json!({
                        "id": id, "object": "chat.completion.chunk", "created": created, "model": model,
                        "choices": [{"index": 0, "delta": {}, "finish_reason": evt["finishReason"]}]
                    })
                };
                Ok::<_, std::convert::Infallible>(Event::default().data(chunk.to_string()))
            })
            .chain(futures::stream::once(async {
                Ok(Event::default().data("[DONE]"))
            }));
        return Sse::new(sse_stream).keep_alive(KeepAlive::default()).into_response();
    }

    let events: Vec<Value> = stream.collect().await;
    let content: String = events
        .iter()
        .filter(|e| e["type"] == "token")
        .filter_map(|e| e["text"].as_str())
        .collect();
    let calls: Vec<Value> = events.iter().filter(|e| e["type"] == "tool-call").map(tool_call).collect();
    let finish = if calls.is_empty() {
        events
            .iter()
            .rev()
            .find(|e| e["type"] == "done")
            .map(|e| e["finishReason"].clone())
            .unwrap_or_else(|| json!("stop"))
    } else {
        json!("tool_calls")
    };

    // a speaker can say something and do something in the same breath, so
    // neither one is dropped for the other
    let mut message = json!({"role": "assistant"});
    if !content.is_empty() || calls.is_empty() {
        message["content"] = json!(content);
    }
    if !calls.is_empty() {
        message["tool_calls"] = json!(calls);
    }

    Json(json!({
        "id": id, "object": "chat.completion", "created": created, "model": model,
        "choices": [{"index": 0, "message": message, "finish_reason": finish}]
    }))
    .into_response()
}

/// A gb-llm tool-call event in the OpenAI shape: arguments as JSON text.
fn tool_call(event: &Value) -> Value {
    static N: AtomicU64 = AtomicU64::new(1);
    let id = event["id"]
        .as_str()
        .map(str::to_string)
        .unwrap_or_else(|| format!("call_gb{}", N.fetch_add(1, Ordering::Relaxed)));
    json!({
        "id": id,
        "type": "function",
        "function": {"name": event["name"], "arguments": event["arguments"].to_string()}
    })
}

async fn realtime(ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(handle_realtime)
}

async fn send_json(socket: &mut WebSocket, value: Value) -> bool {
    socket.send(Message::Text(value.to_string().into())).await.is_ok()
}

async fn handle_realtime(mut socket: WebSocket) {
    let mut session = gb_stt::new_session();
    while let Some(Ok(message)) = socket.recv().await {
        let Message::Text(text) = message else { continue };
        let Ok(event) = serde_json::from_str::<Value>(&text) else {
            if !send_json(&mut socket, json!({"type": "error", "error": {"message": "message is not valid JSON", "type": "invalid_request_error"}})).await {
                return;
            }
            continue;
        };
        match event["type"].as_str() {
            Some("input_audio_buffer.append") => match session.push(&event["audio"]) {
                Ok(events) => {
                    for e in events {
                        let out = json!({"type": "transcription.partial", "text": e["text"]});
                        if !send_json(&mut socket, out).await {
                            return;
                        }
                    }
                }
                Err(e) => {
                    let out = json!({"type": "error", "error": {"message": e.to_string(), "type": "invalid_request_error"}});
                    if !send_json(&mut socket, out).await {
                        return;
                    }
                }
            },
            Some("input_audio_buffer.commit") => {
                for e in session.finish() {
                    let out = json!({"type": "transcription.completed", "text": e["text"]});
                    if !send_json(&mut socket, out).await {
                        return;
                    }
                }
            }
            _ => {
                let out = json!({"type": "error", "error": {"message": "unknown event type", "type": "invalid_request_error"}});
                if !send_json(&mut socket, out).await {
                    return;
                }
            }
        }
    }
}
