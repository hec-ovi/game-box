# gb-api contract

contractVersion: 0.1.0

## Purpose

Expose game-box to game clients as an OpenAI-compatible loopback HTTP/WebSocket API.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `POST /v1/chat/completions` body | [schema/chat-request.json](schema/chat-request.json) | JSON body; `messages` non-empty; `stream` optional; `tools` and `tool_choice` optional, for callers that want a typed call back instead of prose |
| `/v1/realtime` client events (WebSocket text frames) | [schema/realtime-client-event.json](schema/realtime-client-event.json) | audio only as the base64 PCM envelope, never binary frames |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| chat response (non-streaming) | [schema/chat-response.json](schema/chat-response.json) | one assistant message: `content` when the model wrote prose, `tool_calls` with `finish_reason: "tool_calls"` when it called a tool |
| chat SSE chunk (streaming, each `data:` payload) | [schema/chat-stream-event.json](schema/chat-stream-event.json) | token chunks with `finish_reason: null`, one chunk per completed tool call, one closing chunk with a finish_reason, then literal `data: [DONE]` |
| realtime server events | [schema/realtime-server-event.json](schema/realtime-server-event.json) | `transcription.partial` per accepted append; `transcription.completed` on commit; `error` never closes the socket |
| error body (HTTP 4xx/5xx) | [schema/error.json](schema/error.json) | every non-2xx response carries this body |
| `GET /health` | inline: `{status:"ok", service:"game-box", contractVersion}` | always 200 when the process is up |

## Events

SSE stream for chat; WebSocket events for realtime, as listed in Outputs.

## Errors (closed set)

- HTTP 400 `invalid_request_error`: body not JSON or failed schema validation.
- HTTP 502 `server_error`: the LLM upstream engine failed before streaming started.
- WS `error` event `invalid_request_error`: malformed frame, unknown event type, or invalid audio envelope; session state is unchanged.

## Dependencies

- `gb-llm` contract (llm/CONTRACT.md): chat is mapped onto `generate-request` / `token-event`.
- `gb-stt` contract (stt/CONTRACT.md): realtime append/commit is mapped onto `audio-chunk` / `transcript-event`.

## Invariants

- The server binds 127.0.0.1 only (port from `GAME_BOX_PORT`, default 8976); never a public interface.
- Every request body is validated against this layer's schemas before any other layer is called (fail closed).
- No output-length cap is ever accepted or forwarded; responses end when generation ends.
- Tool definitions and the tool choice are forwarded to the engine unchanged, and a tool call comes back in the OpenAI shape with its arguments as JSON text. A caller that offers a tool gets either a complete call or an error, never a half-built one.
- A WS `error` event leaves the recognition session exactly as it was.

## How to modify this blackbox safely

Add endpoints/eventtypes additively (minor contractVersion bump); never change the meaning of an existing field in place. New surface (e.g. `/v1/audio/speech` when the TTS layer lands) gets its own schemas here plus a dependency line on the new layer's contract. Run `cargo test -p gb-api` (end-to-end over real HTTP/WS); update this file and `schema/` in the same change.
