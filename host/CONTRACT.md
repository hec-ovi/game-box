# host contract

contractVersion: 0.5.0

## Purpose

Serve local text generation, speech recognition and speech synthesis to any client as an OpenAI-compatible loopback HTTP and WebSocket API.

## Running it

```
pnpm -C host dev      # reads .env at the repository root
pnpm -C host start    # reads nothing: export the variables yourself
```

```
GAME_BOX_LLM_UPSTREAM=http://127.0.0.1:8080 \
  node --experimental-strip-types tools/repeatable.ts    # does the engine repeat itself?
GAME_BOX_LLM_UPSTREAM=http://127.0.0.1:8080 \
  node --experimental-strip-types tools/forced-call.ts   # does a forced tool call come back as one?
GAME_BOX_LLM_UPSTREAM=openrouter \
  node --env-file=.env --experimental-strip-types tools/forced-call.ts [model ...]   # the same, per hosted model
```

Node 22 or newer, one dependency (zod), no build step. The port comes from `GAME_BOX_PORT` (default 8976) and the socket is bound to 127.0.0.1 only.

| Variable | Meaning |
|---|---|
| `GAME_BOX_PORT` | listening port, default 8976 |
| `GAME_BOX_LLM_UPSTREAM` | where generation goes. Unset for the deterministic stand-in, the word `openrouter` for the hosted router, or the base URL of an OpenAI-compatible engine of your own (llama-server and friends) |
| `OPENROUTER_API_KEY` | read only when the line above says `openrouter` |
| `GAME_BOX_OPENROUTER_BASE` | where OpenRouter lives, default `https://openrouter.ai/api/v1`. For an OpenRouter-compatible gateway |
| `GAME_BOX_MODELS_DIR` | model cache directory, default the platform cache directory plus `game-box/models` |

`.env.example` at the repository root names these with empty values. `dev`
loads `.env` from there through Node's `--env-file`, and a variable already
exported wins over the file. `start` and the tools read only what is exported,
so run a tool with `node --env-file=.env ...` when it needs the file.

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
| chat response (non-streaming) | [schema/api/chat-response.json](schema/api/chat-response.json) | one assistant message carrying whatever the engine produced: `content`, `tool_calls`, or both, with `finish_reason: "tool_calls"` whenever there is a call; `salvaged` counts the calls rebuilt from prose, and is absent when none was |
| chat SSE chunk (streaming, each `data:` payload) | [schema/api/chat-stream-event.json](schema/api/chat-stream-event.json) | token chunks with `finish_reason: null`, one chunk per completed tool call (`salvaged: 1` on it when the call was rebuilt from prose), one closing chunk with a finish reason, then literal `data: [DONE]` |
| realtime server events | [schema/api/realtime-server-event.json](schema/api/realtime-server-event.json) | `transcription.partial` per accepted append; `transcription.completed` on commit; `error` never closes the socket |
| error body (HTTP 4xx/5xx) | [schema/api/error.json](schema/api/error.json) | every non-2xx response carries this body; a 429 also carries a `Retry-After` header in whole seconds |
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

## Forcing a call

A request that insists on one tool (a `tool_choice` naming it, or `required`
with one tool offered) gets one call back, or prose it can see is prose. The
shape the engine is asked in depends on the upstream, because they differ in
what they honour. `auto`, `none`, and `required` over several tools force
nothing and go out unchanged.

Measured on 2026-08-25 against llama-server b10603 (gemma-4-26b-a4b,
`--jinja`, `--parallel 5`) with a quest tool whose steps carry a `next` array,
and a system line asking for the quest as JSON:

- A named `tool_choice` is read as `auto`: 19 of 20 replies were a ```json
  block with `finish_reason: "stop"` and no call, and a prompt asking for the
  word hello got "Hello." 5 times of 5.
- `required` forbids the end of the reply until a call arrives but does not
  make the call come first: 2 of 5 replies finished (one after writing the
  block anyway), 3 ran past a 100 s cap, and the hello prompt looped for
  4,531 tokens in 90 s without ending.
- `response_format: {"type": "json_schema"}` built from the tool's parameters
  is enforced by the grammar from the first token: 5 of 5 replies sent
  directly were bare JSON objects fitting the schema, `next` an array, about
  14 s each. Through this service, with the same prompt: 20 of 20 non-streamed and 5 of 5 streamed forced calls came back as the call, 0 prose, `next` an array in every one, 11 to 17 s each.

So a server of your own is sent the tool's parameters as `response_format`,
`tool_choice: "none"`, and its `tools` as they are, and the JSON it writes is
read back as the call. OpenRouter is sent the choice itself, which it honours
(see below).

On either path a reply that arrives as prose carrying a JSON block that fits
the tool's parameters (the whole text, the inside of a code fence, or the
span between its first and last brace) becomes the call it was, and the reply
counts it in `salvaged`, so a caller can see the engine did not call on its
own. A call asked for as JSON is the answer by design and counts nothing.
Text that is not the call, or that fails the parameters, stays prose with
`finish_reason: "stop"`; a reply that ended for any other reason is left as it
came. The check is zod's reading of the JSON Schema, and a schema it cannot
read (`not`, `if`/`then`, `unevaluatedProperties`, `dependentRequired`, an
external `$ref`) validates nothing, so no call is rebuilt against it.

The text of a forced reply is held until the reply ends, since only then is
it known whether it was the call; a streamed forced call therefore arrives as
its call chunk and the closing chunk together.

## A busy model

A rate limit is not a failure. The upstream saying 429, either as the HTTP
status or as the first streamed payload of a 200 (`{"choices":[],"error":{"code":429}}`,
measured from OpenRouter, see below), is answered as HTTP 429 with
`Retry-After` in whole seconds and an error body whose `code` is `model-busy`.

The seconds are the upstream's own when it sent a `Retry-After` (a count passes
through as it is; an HTTP date becomes the seconds left until it). When it sent
none, they are a backoff: 1 s, doubling per consecutive refusal up to 60 s, and
starting over on the next answer of any other kind.

The upstream is asked once per request. Waiting and asking again are the
caller's decisions, and the header says how long; this service never retries on
its behalf. A page in a browser can read the header: it is CORS-exposed.

## What OpenRouter answers

Measured on 2026-08-25 with `tools/forced-call.ts`, the owner's key, and the
request shape the game sends (`tools` plus a `tool_choice` naming the
function), streamed and not, against `stealth/ox-alpha` and the other free
tool-calling models the account lists.

- A capped free model answers HTTP 429 with a JSON body (`"code": 429`,
  `limit_source: upstream_provider_shared_pool`, "temporarily rate-limited
  upstream, please retry shortly") and no `Retry-After` header, to both stream
  shapes and both tool choices alike. The wait a caller sees is therefore this
  service's backoff. Over one afternoon every free model on the account
  (`stealth/ox-alpha`, `google/gemma-4-26b-a4b-it:free`, `z-ai/glm-5.2:free`)
  spent long stretches in that state.
- `openai/gpt-4o-mini` and `openai/gpt-4.1-mini` answer HTTP 404, "No endpoints
  available matching your guardrail restrictions and data policy". That is the
  account's privacy setting (openrouter.ai/settings/privacy), which leaves it
  11 models, 6 of them with tools and all free (`GET /models/user`). A paid,
  known tool-calling model cannot be measured from this account until that
  setting changes.
- The request shape is right. `google/gemma-4-26b-a4b-it:free` answered a
  named `tool_choice` with `finish_reason: "tool_calls"` and a whole
  `name_city` call, non-streamed (`{"name":"Paris"}`, twice) and streamed
  through this service (the call arrives as an `id` plus `name` delta, then an
  `arguments` delta, then the finish chunk), and `required` the same way.
  OpenRouter prefixes a stream with `: OPENROUTER PROCESSING` comment lines
  and a non-streamed body with up to about 1 KB of whitespace while the
  provider thinks; both are skipped.
- `stealth/ox-alpha` given a named `tool_choice` answered HTTP 200 with the
  body `{"error":{"message":"Provider returned error","code":429}}` after 41 s
  of keep-alive whitespace, and no `choices` at all. That is the "content null,
  no tool_calls" reading: a rate limit inside a 200, which this service answers
  as 429 `model-busy` when it arrives as the first streamed payload.
  Streamed, the same request came back HTTP 200 `text/event-stream` with one
  payload, `{"model":"unknown","provider":"Stealth","choices":[],"error":{"code":429,"message":"Provider returned error","metadata":{"error_type":"rate_limit_exceeded"}}}`,
  which this service answers as 429 `model-busy` too. Nothing about the model's
  tool calling was measurable through that: every answer it gave a forced call
  today was a rate limit, plain prompts and `tool_choice: "auto"` got through
  in the same minutes.

## Events

SSE stream for chat; WebSocket events for realtime, as listed in Outputs.

## Errors (closed set)

- HTTP 400 `invalid_request_error`: body not JSON, failed schema validation, or a WebSocket endpoint asked for over plain HTTP.
- HTTP 404 `invalid_request_error`: no such endpoint.
- HTTP 405 `invalid_request_error`: wrong method for that endpoint.
- HTTP 413 `invalid_request_error`: request body over 8 MiB.
- HTTP 429 `rate_limit_error`, code `model-busy`: the upstream is rate-limited. `Retry-After` carries the seconds to wait, as described above.
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
- A rate limit is answered as 429 with a wait, never as a failure, and never retried inside this service.
- A credential is read from the environment, sent only to the upstream it belongs to, and scrubbed out of every error this service returns. A URL you configure yourself is always called unauthenticated.
- Tool definitions are forwarded to the engine unchanged. A call the request insists on is asked for in the shape the upstream honours, and comes back in the OpenAI shape with its arguments as JSON text; when it was rebuilt from prose the reply says so. A caller that offers a tool gets either a complete call or an error, never a half-built one.
- Speaking and acting are not exclusive: a reply that carries both text and a call keeps both, because a character who says something while doing it must not lose either half.
- A WS `error` event leaves the recognition session exactly as it was.
- Audio only ever crosses a boundary as a schema-validated base64 envelope, never as bare bytes.
- `schema/` is generated from the same zod objects the code validates with, so what this file links to and what the service enforces cannot drift apart.

## Inside

Four layers behind the endpoints, each with its own schemas and its own seam for a real engine. Callers never see them; they exist so an engine can be swapped without touching the API.

| Layer | Takes | Gives | Engine today |
|---|---|---|---|
| `src/llm` | [generate-request](schema/llm/generate-request.json) | stream of [token-event](schema/llm/token-event.json), always exactly one `done`; a `tool-call` rebuilt from prose carries `salvaged: true` | proxy to whatever `GAME_BOX_LLM_UPSTREAM` selects, asking for a forced call in the shape that upstream honours, or a stand-in that replies `You said: <last user message>` and answers a forced tool choice with an empty call |
| `src/stt` | [audio-chunk](schema/stt/audio-chunk.json) per `push` | [transcript-event](schema/stt/transcript-event.json): `partial` per push, one `final` per `finish` | stand-in that reports heard duration |
| `src/tts` | [speak-request](schema/tts/speak-request.json), then any text slice | [audio-event](schema/tts/audio-event.json): 80 ms `frame`s while the sentence is still being written, one `end` | stand-in that emits silence timed from the text |
| `src/models` | [model-entry](schema/models/model-entry.json) | [resolved-model](schema/models/resolved-model.json) | streaming sha256 over the cache directory; nothing is returned unverified |

The layers hand back a `Result` rather than throwing: `{ok: true, value}` or `{ok: false, error}` with a `code` from that layer's closed set (`invalid-request`, `upstream`, `busy`, `invalid-chunk`, `unknown-voice`, `invalid-entry`, `missing`, `integrity`, `unreadable`).

## How to modify this blackbox safely

Add endpoints and event types additively (minor contractVersion bump); never change the meaning of an existing field in place. Schemas are generated, so edit the zod object in `src/*/schema.ts` and run `pnpm -C host generate`; a stale `schema/` fails the tests. Swapping in a real engine (llama.cpp, sherpa-onnx, Kyutai Pocket TTS) is a change inside one layer folder as long as its schemas still validate. Run `pnpm -C host test` (the whole surface over real HTTP and a real WebSocket) and `pnpm -C host typecheck`; update this file and `schema/` in the same change.
