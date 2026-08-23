# host contract

contractVersion: 0.3.0

## Purpose

Serve local text generation, speech recognition and speech synthesis to any client as an OpenAI-compatible loopback HTTP and WebSocket API.

## Running it

```
node --experimental-strip-types src/main.ts     # or: npm start
```

```
GAME_BOX_LLM_UPSTREAM=http://127.0.0.1:8080 \
  node --experimental-strip-types tools/repeatable.ts   # does the engine repeat itself?
GAME_BOX_LLM_UPSTREAM=openrouter \
  node --env-file=.env --experimental-strip-types tools/repeatable.ts
```

Node 22 or newer, one dependency (zod), no build step. The port comes from `GAME_BOX_PORT` (default 8976) and the socket is bound to 127.0.0.1 only.

| Variable | Meaning |
|---|---|
| `GAME_BOX_PORT` | listening port, default 8976 |
| `GAME_BOX_LLM_UPSTREAM` | where generation goes. Unset for the deterministic stand-in, the word `openrouter` for the hosted router, or the base URL of an OpenAI-compatible engine of your own (llama-server and friends) |
| `OPENROUTER_API_KEY` | read only when the line above says `openrouter` |
| `GAME_BOX_OPENROUTER_BASE` | where OpenRouter lives, default `https://openrouter.ai/api/v1`. For an OpenRouter-compatible gateway |
| `GAME_BOX_MODELS_DIR` | model cache directory, default the platform cache directory plus `game-box/models` |

`.env.example` at the repository root names these with empty values. Nothing
loads a `.env` on its own: run with `node --env-file=.env ...` or export them.

A base URL may or may not already end in `/v1`. Both are joined correctly, so
neither `http://127.0.0.1:8080` nor `https://openrouter.ai/api/v1` has to be
written with a segment left off.

The model a request gets when it names none belongs to the upstream, not to the
request path: `default` for a server of your own, `stealth/ox-alpha` through
OpenRouter.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `POST /v1/chat/completions` body | [schema/api/chat-request.json](schema/api/chat-request.json) | JSON body; `messages` non-empty; `stream` optional; `tools` and `tool_choice` optional, for callers that want a typed call back instead of prose; `temperature` and `seed` optional, and both reach the engine unchanged |
| `/v1/realtime` client events (WebSocket text frames) | [schema/api/realtime-client-event.json](schema/api/realtime-client-event.json) | audio only as the base64 PCM envelope, never binary frames |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| chat response (non-streaming) | [schema/api/chat-response.json](schema/api/chat-response.json) | one assistant message carrying whatever the engine produced: `content`, `tool_calls`, or both, with `finish_reason: "tool_calls"` whenever there is a call |
| chat SSE chunk (streaming, each `data:` payload) | [schema/api/chat-stream-event.json](schema/api/chat-stream-event.json) | token chunks with `finish_reason: null`, one chunk per completed tool call, one closing chunk with a finish reason, then literal `data: [DONE]` |
| realtime server events | [schema/api/realtime-server-event.json](schema/api/realtime-server-event.json) | `transcription.partial` per accepted append; `transcription.completed` on commit; `error` never closes the socket |
| error body (HTTP 4xx/5xx) | [schema/api/error.json](schema/api/error.json) | every non-2xx response carries this body |
| `GET /health` | inline: `{status:"ok", service:"game-box", contractVersion}` | always 200 when the process is up |

## Getting the same answer twice

Send `temperature: 0` and a `seed`. Temperature 0 asks the engine to take its
most likely token every time; the seed pins the draw it still has to make,
because without one the engine picks a fresh seed per request.

`seed` is a 32-bit integer, 0 to 4294967294. The top value, 4294967295, is what
llama.cpp reads as "pick one at random", so a request carrying it is refused
rather than quietly left unpinned.

The service invents neither value. A request that pins nothing gets whatever the
engine's defaults produce, which is a different answer each time.

Repeating is then the engine's job, and this service cannot promise it on the
engine's behalf. Measured through `tools/repeatable.ts` on 2026-08-23,
`stealth/ox-alpha` through OpenRouter answered three differently to the same
pinned request, run one at a time, so the hosted path does not repeat itself
today. OpenRouter says as much: it forwards `seed` to providers that support it
and "determinism is not guaranteed for some models".

A self-hosted llama-server has its own reasons to wander. Prompt-cache reuse and
continuous batching both change the batch shape a token is computed in, and
llama.cpp does not guarantee bit-identical logits across batch shapes, so an
answer computed beside four other requests can differ from the same answer
computed alone. Starting it with `--parallel 1` removes that, at the cost of
requests queueing instead of fanning out.

Run `tools/repeatable.ts` against whichever engine is configured, as it is
actually started, rather than assuming either answer holds.

## Events

SSE stream for chat; WebSocket events for realtime, as listed in Outputs.

## Errors (closed set)

- HTTP 400 `invalid_request_error`: body not JSON, failed schema validation, or a WebSocket endpoint asked for over plain HTTP.
- HTTP 404 `invalid_request_error`: no such endpoint.
- HTTP 405 `invalid_request_error`: wrong method for that endpoint.
- HTTP 413 `invalid_request_error`: request body over 8 MiB.
- HTTP 502 `server_error`: the LLM upstream engine failed before streaming started, or it is misconfigured (`GAME_BOX_LLM_UPSTREAM is not a URL`, `OPENROUTER_API_KEY is not set`).
- `finish_reason: "error"` (HTTP 200): the engine broke after the reply started. The answer carries whatever arrived first; it never claims to have stopped normally.
- WS `error` event `invalid_request_error`: malformed frame, unknown event type, or invalid audio envelope; session state is unchanged.

## Dependencies

None. This service knows about text, audio, tools and models; it does not know what a quest, an NPC, a city or an item is, and it imports nothing from the rest of the repository. Copy the folder somewhere else and it runs.

## Invariants

- The server binds 127.0.0.1 only; never a public interface.
- Every request body is validated against this layer's schemas before any other layer is called (fail closed).
- No output-length cap is ever accepted or forwarded; responses end when generation ends.
- Sampler settings are the caller's to make. None is defaulted, none is dropped: what a request pins reaches the engine, and what it leaves out is left out.
- A credential is read from the environment, sent only to the upstream it belongs to, and scrubbed out of every error this service returns. A URL you configure yourself is always called unauthenticated.
- Tool definitions and the tool choice are forwarded to the engine unchanged, and a tool call comes back in the OpenAI shape with its arguments as JSON text. A caller that offers a tool gets either a complete call or an error, never a half-built one.
- Speaking and acting are not exclusive: a reply that carries both text and a call keeps both, because a character who says something while doing it must not lose either half.
- A WS `error` event leaves the recognition session exactly as it was.
- Audio only ever crosses a boundary as a schema-validated base64 envelope, never as bare bytes.
- `schema/` is generated from the same zod objects the code validates with, so what this file links to and what the service enforces cannot drift apart.

## Inside

Four layers behind the endpoints, each with its own schemas and its own seam for a real engine. Callers never see them; they exist so an engine can be swapped without touching the API.

| Layer | Takes | Gives | Engine today |
|---|---|---|---|
| `src/llm` | [generate-request](schema/llm/generate-request.json) | stream of [token-event](schema/llm/token-event.json), always exactly one `done` | proxy to whatever `GAME_BOX_LLM_UPSTREAM` selects, or a stand-in that replies `You said: <last user message>` and answers a forced tool choice with an empty call |
| `src/stt` | [audio-chunk](schema/stt/audio-chunk.json) per `push` | [transcript-event](schema/stt/transcript-event.json): `partial` per push, one `final` per `finish` | stand-in that reports heard duration |
| `src/tts` | [speak-request](schema/tts/speak-request.json), then any text slice | [audio-event](schema/tts/audio-event.json): 80 ms `frame`s while the sentence is still being written, one `end` | stand-in that emits silence timed from the text |
| `src/models` | [model-entry](schema/models/model-entry.json) | [resolved-model](schema/models/resolved-model.json) | streaming sha256 over the cache directory; nothing is returned unverified |

The layers hand back a `Result` rather than throwing: `{ok: true, value}` or `{ok: false, error}` with a `code` from that layer's closed set (`invalid-request`, `upstream`, `invalid-chunk`, `unknown-voice`, `invalid-entry`, `missing`, `integrity`, `unreadable`).

## How to modify this blackbox safely

Add endpoints and event types additively (minor contractVersion bump); never change the meaning of an existing field in place. Schemas are generated, so edit the zod object in `src/*/schema.ts` and run `npm run generate`; a stale `schema/` fails the tests. Swapping in a real engine (llama.cpp, sherpa-onnx, Kyutai Pocket TTS) is a change inside one layer folder as long as its schemas still validate. Run `npm test` (the whole surface over real HTTP and a real WebSocket) and `npm run typecheck`; update this file and `schema/` in the same change.
