//! gb-llm: text-generation blackbox. Outsiders read CONTRACT.md + schema/ only.

use futures::stream::{self, BoxStream, StreamExt};
use serde_json::{json, Value};
use std::sync::OnceLock;

static REQ_SCHEMA: &str = include_str!("../schema/generate-request.json");
static EVT_SCHEMA: &str = include_str!("../schema/token-event.json");

fn validator(raw: &'static str, cell: &'static OnceLock<jsonschema::Validator>) -> &'static jsonschema::Validator {
    cell.get_or_init(|| {
        jsonschema::validator_for(&serde_json::from_str(raw).expect("schema is valid JSON"))
            .expect("schema compiles")
    })
}

static REQ_V: OnceLock<jsonschema::Validator> = OnceLock::new();
static EVT_V: OnceLock<jsonschema::Validator> = OnceLock::new();

#[derive(Debug)]
pub enum LlmError {
    InvalidRequest(String),
    Upstream(String),
}

impl std::fmt::Display for LlmError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LlmError::InvalidRequest(m) => write!(f, "invalid request: {m}"),
            LlmError::Upstream(m) => write!(f, "upstream error: {m}"),
        }
    }
}

impl std::error::Error for LlmError {}

/// Boundary function. Validates the request against `schema/generate-request.json`,
/// returns a stream of events each conforming to `schema/token-event.json`,
/// always terminated by exactly one `done` event.
///
/// Engine selection: if `GAME_BOX_LLM_UPSTREAM` is set, generation is proxied to that
/// OpenAI-compatible server (e.g. llama-server); otherwise the deterministic stand-in runs.
pub async fn generate(request: Value) -> Result<BoxStream<'static, Value>, LlmError> {
    validator(REQ_SCHEMA, &REQ_V)
        .validate(&request)
        .map_err(|e| LlmError::InvalidRequest(e.to_string()))?;

    let inner = match std::env::var("GAME_BOX_LLM_UPSTREAM") {
        Ok(base) if !base.trim().is_empty() => upstream::generate(base.trim().to_string(), &request).await?,
        _ => standin::generate(&request),
    };

    // Fail closed at the boundary: drop any event that does not validate.
    let checked = inner.filter(|evt| {
        let ok = validator(EVT_SCHEMA, &EVT_V).is_valid(evt);
        async move { ok }
    });
    Ok(checked.boxed())
}

mod standin {
    use super::*;

    pub fn generate(req: &Value) -> BoxStream<'static, Value> {
        let last_user = req["messages"]
            .as_array()
            .and_then(|m| m.iter().rev().find(|x| x["role"] == "user"))
            .and_then(|m| m["content"].as_str())
            .unwrap_or("")
            .to_string();
        let text = format!("You said: {last_user}");
        let mut events: Vec<Value> = text
            .split_inclusive(' ')
            .map(|w| json!({"type": "token", "text": w}))
            .collect();
        events.push(json!({"type": "done", "finishReason": "stop"}));
        stream::iter(events).boxed()
    }
}

mod upstream {
    use super::*;

    pub async fn generate(base: String, req: &Value) -> Result<BoxStream<'static, Value>, LlmError> {
        // No output-length cap is ever sent: the model must finish naturally.
        let mut body = json!({
            "model": req.get("model").cloned().unwrap_or_else(|| json!("default")),
            "messages": req["messages"],
            "stream": true,
        });
        if let Some(t) = req.get("temperature") {
            body["temperature"] = t.clone();
        }

        let resp = reqwest::Client::new()
            .post(format!("{base}/v1/chat/completions"))
            .json(&body)
            .send()
            .await
            .map_err(|e| LlmError::Upstream(e.to_string()))?;
        if !resp.status().is_success() {
            return Err(LlmError::Upstream(format!("status {}", resp.status())));
        }

        let mut bytes = resp.bytes_stream();
        let s = async_stream::stream! {
            let mut buf = String::new();
            while let Some(chunk) = bytes.next().await {
                let Ok(chunk) = chunk else {
                    yield json!({"type": "done", "finishReason": "error"});
                    return;
                };
                buf.push_str(&String::from_utf8_lossy(&chunk));
                while let Some(pos) = buf.find('\n') {
                    let line = buf[..pos].trim().to_string();
                    buf.drain(..=pos);
                    let Some(data) = line.strip_prefix("data: ") else { continue };
                    if data == "[DONE]" {
                        yield json!({"type": "done", "finishReason": "stop"});
                        return;
                    }
                    let Ok(v) = serde_json::from_str::<Value>(data) else { continue };
                    if let Some(t) = v["choices"][0]["delta"]["content"].as_str() {
                        if !t.is_empty() {
                            yield json!({"type": "token", "text": t});
                        }
                    }
                    if let Some(fr) = v["choices"][0]["finish_reason"].as_str() {
                        let reason = if fr == "length" { "length" } else { "stop" };
                        yield json!({"type": "done", "finishReason": reason});
                        return;
                    }
                }
            }
            yield json!({"type": "done", "finishReason": "stop"});
        };
        Ok(s.boxed())
    }
}
