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
        // Asked for a tool call, the stand-in makes the call with no arguments:
        // the caller's own schema is then what rejects it, rather than prose
        // being read as data.
        if let Some(name) = forced_tool(req) {
            return stream::iter(vec![
                json!({"type": "tool-call", "name": name, "arguments": {}}),
                json!({"type": "done", "finishReason": "stop"}),
            ])
            .boxed();
        }
        let text = format!("You said: {last_user}");
        let mut events: Vec<Value> = text
            .split_inclusive(' ')
            .map(|w| json!({"type": "token", "text": w}))
            .collect();
        events.push(json!({"type": "done", "finishReason": "stop"}));
        stream::iter(events).boxed()
    }

    /// The tool the request insists on, if it insists on one.
    fn forced_tool(req: &Value) -> Option<String> {
        let named = req["tool_choice"]["function"]["name"].as_str();
        if let Some(name) = named {
            return Some(name.to_string());
        }
        let required = req["tool_choice"].as_str() == Some("required");
        if !required {
            return None;
        }
        req["tools"][0]["function"]["name"].as_str().map(str::to_string)
    }
}

mod upstream {
    use super::*;

    /// A tool call being assembled from stream deltas.
    #[derive(Default)]
    pub struct PendingCall {
        id: Option<String>,
        name: String,
        arguments: String,
    }

    impl PendingCall {
        fn absorb(&mut self, delta: &Value) {
            if let Some(id) = delta["id"].as_str() {
                self.id = Some(id.to_string());
            }
            if let Some(name) = delta["function"]["name"].as_str() {
                self.name.push_str(name);
            }
            if let Some(args) = delta["function"]["arguments"].as_str() {
                self.arguments.push_str(args);
            }
        }

        /// An event only if the call is named and its arguments are a JSON object.
        fn finish(self) -> Option<Value> {
            if self.name.is_empty() {
                return None;
            }
            let text = if self.arguments.trim().is_empty() { "{}" } else { self.arguments.trim() };
            let parsed: Value = serde_json::from_str(text).ok()?;
            if !parsed.is_object() {
                return None;
            }
            let mut event = json!({"type": "tool-call", "name": self.name, "arguments": parsed});
            if let Some(id) = self.id {
                event["id"] = json!(id);
            }
            Some(event)
        }
    }

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
        if let Some(tools) = req.get("tools") {
            body["tools"] = tools.clone();
        }
        if let Some(choice) = req.get("tool_choice") {
            body["tool_choice"] = choice.clone();
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
            // A tool call arrives split across deltas; it is only an event once
            // it is whole and its arguments parse.
            let mut call: Option<PendingCall> = None;
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
                        if let Some(event) = call.take().and_then(PendingCall::finish) {
                            yield event;
                        }
                        yield json!({"type": "done", "finishReason": "stop"});
                        return;
                    }
                    let Ok(v) = serde_json::from_str::<Value>(data) else { continue };
                    if let Some(t) = v["choices"][0]["delta"]["content"].as_str() {
                        if !t.is_empty() {
                            yield json!({"type": "token", "text": t});
                        }
                    }
                    for delta in v["choices"][0]["delta"]["tool_calls"].as_array().into_iter().flatten() {
                        let pending = call.get_or_insert_with(PendingCall::default);
                        pending.absorb(delta);
                    }
                    if let Some(fr) = v["choices"][0]["finish_reason"].as_str() {
                        let finished = call.take().and_then(PendingCall::finish);
                        let unparseable = fr == "tool_calls" && finished.is_none();
                        if let Some(event) = finished {
                            yield event;
                        }
                        let reason = match fr {
                            "length" => "length",
                            _ if unparseable => "error",
                            _ => "stop",
                        };
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
