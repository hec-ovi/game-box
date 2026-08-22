# host contract

contractVersion: 0.1.0

## Purpose

Serve local text generation, speech recognition and speech synthesis to any client as an OpenAI-compatible loopback HTTP and WebSocket API.

## Running it

```
node --experimental-strip-types src/main.ts     # or: npm start
```

Node 22 or newer, one dependency (zod), no build step. The port comes from `GAME_BOX_PORT` (default 8976) and the socket is bound to 127.0.0.1 only.

| Variable | Meaning |
|---|---|
| `GAME_BOX_PORT` | listening port, default 8976 |
| `GAME_BOX_LLM_UPSTREAM` | base URL of an OpenAI-compatible engine (llama-server and friends). Unset means the deterministic stand-in |
| `GAME_BOX_MODELS_DIR` | model cache directory, default the platform cache directory plus `game-box/models` |

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `POST /v1/chat/completions` body | [schema/api/chat-request.json](schema/api/chat-request.json) | JSON body; `messages` non-empty; `stream` optional; `tools` and `tool_choice` optional, for callers that want a typed call back instead of prose |
| `/v1/realtime` client events (WebSocket text frames) | [schema/api/realtime-client-event.json](schema/api/realtime-client-event.json) | audio only as the base64 PCM envelope, never binary frames |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| chat response (non-streaming) | [schema/api/chat-response.json](schema/api/chat-response.json) | one assistant message carrying whatever the engine produced: `content`, `tool_calls`, or both, with `finish_reason: "tool_calls"` whenever there is a call |
| chat SSE chunk (streaming, each `data:` payload) | [schema/api/chat-stream-event.json](schema/api/chat-stream-event.json) | token chunks with `finish_reason: null`, one chunk per completed tool call, one closing chunk with a finish reason, then literal `data: [DONE]` |
| realtime server events | [schema/api/realtime-server-event.json](schema/api/realtime-server-event.json) | `transcription.partial` per accepted append; `transcription.completed` on commit; `error` never closes the socket |
| error body (HTTP 4xx/5xx) | [schema/api/error.json](schema/api/error.json) | every non-2xx response carries this body |
| `GET /health` | inline: `{status:"ok", service:"game-box", contractVersion}` | always 200 when the process is up |

## Events

SSE stream for chat; WebSocket events for realtime, as listed in Outputs.

## Errors (closed set)

- HTTP 400 `invalid_request_error`: body not JSON, failed schema validation, or a WebSocket endpoint asked for over plain HTTP.
- HTTP 404 `invalid_request_error`: no such endpoint.
- HTTP 405 `invalid_request_error`: wrong method for that endpoint.
- HTTP 413 `invalid_request_error`: request body over 8 MiB.
- HTTP 502 `server_error`: the LLM upstream engine failed before streaming started.
- WS `error` event `invalid_request_error`: malformed frame, unknown event type, or invalid audio envelope; session state is unchanged.

## Dependencies

None. This service knows about text, audio, tools and models; it does not know what a quest, an NPC, a city or an item is, and it imports nothing from the rest of the repository. Copy the folder somewhere else and it runs.

## Invariants

- The server binds 127.0.0.1 only; never a public interface.
- Every request body is validated against this layer's schemas before any other layer is called (fail closed).
- No output-length cap is ever accepted or forwarded; responses end when generation ends.
- Tool definitions and the tool choice are forwarded to the engine unchanged, and a tool call comes back in the OpenAI shape with its arguments as JSON text. A caller that offers a tool gets either a complete call or an error, never a half-built one.
- Speaking and acting are not exclusive: a reply that carries both text and a call keeps both, because a character who says something while doing it must not lose either half.
- A WS `error` event leaves the recognition session exactly as it was.
- Audio only ever crosses a boundary as a schema-validated base64 envelope, never as bare bytes.
- `schema/` is generated from the same zod objects the code validates with, so what this file links to and what the service enforces cannot drift apart.

## Inside

Four layers behind the endpoints, each with its own schemas and its own seam for a real engine. Callers never see them; they exist so an engine can be swapped without touching the API.

| Layer | Takes | Gives | Engine today |
|---|---|---|---|
| `src/llm` | [generate-request](schema/llm/generate-request.json) | stream of [token-event](schema/llm/token-event.json), always exactly one `done` | proxy to `GAME_BOX_LLM_UPSTREAM`, or a stand-in that replies `You said: <last user message>` and answers a forced tool choice with an empty call |
| `src/stt` | [audio-chunk](schema/stt/audio-chunk.json) per `push` | [transcript-event](schema/stt/transcript-event.json): `partial` per push, one `final` per `finish` | stand-in that reports heard duration |
| `src/tts` | [speak-request](schema/tts/speak-request.json), then any text slice | [audio-event](schema/tts/audio-event.json): 80 ms `frame`s while the sentence is still being written, one `end` | stand-in that emits silence timed from the text |
| `src/models` | [model-entry](schema/models/model-entry.json) | [resolved-model](schema/models/resolved-model.json) | streaming sha256 over the cache directory; nothing is returned unverified |

The layers hand back a `Result` rather than throwing: `{ok: true, value}` or `{ok: false, error}` with a `code` from that layer's closed set (`invalid-request`, `upstream`, `invalid-chunk`, `unknown-voice`, `invalid-entry`, `missing`, `integrity`, `unreadable`).

## How to modify this blackbox safely

Add endpoints and event types additively (minor contractVersion bump); never change the meaning of an existing field in place. Schemas are generated, so edit the zod object in `src/*/schema.ts` and run `npm run generate`; a stale `schema/` fails the tests. Swapping in a real engine (llama.cpp, sherpa-onnx, Kyutai Pocket TTS) is a change inside one layer folder as long as its schemas still validate. Run `npm test` (the whole surface over real HTTP and a real WebSocket) and `npm run typecheck`; update this file and `schema/` in the same change.
