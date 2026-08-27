# host contract

contractVersion: 0.7.0

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
node --experimental-strip-types tools/replay.ts request.json [times] [at-once] [cap-seconds]
  # a saved request through the running service, several at once: seconds, call or prose, fits or not
```

Node 22 or newer, one dependency (zod), no build step. The port comes from `GAME_BOX_PORT` (default 8976) and the socket is bound to 127.0.0.1 only.

| Variable | Meaning |
|---|---|
| `GAME_BOX_PORT` | listening port, default 8976 |
| `GAME_BOX_LLM_UPSTREAM` | where generation goes. Unset for the deterministic stand-in, the word `openrouter` for the hosted router, or the base URL of an OpenAI-compatible engine of your own (llama-server and friends) |
| `OPENROUTER_API_KEY` | read only when the line above says `openrouter` |
| `GAME_BOX_OPENROUTER_BASE` | where OpenRouter lives, default `https://openrouter.ai/api/v1`. For an OpenRouter-compatible gateway |
| `GAME_BOX_MODELS_DIR` | model cache directory, default the platform cache directory plus `game-box/models` |
| `GAME_BOX_SECRETS_FILE` | where the keys live, default `.env.local` beside `host/` |
| `GAME_BOX_CONFIG_FILE` | where the providers and the routing live, default `.game-box.json` beside `host/` |

`.env.example` at the repository root names these with empty values. `dev`
loads `.env` from there through Node's `--env-file`, and a variable already
exported wins over the file. `start` and the tools read only what is exported,
so run a tool with `node --env-file=.env ...` when it needs the file.

A base URL may or may not already end in `/v1`. Both are joined correctly, so
neither `http://127.0.0.1:8080` nor `https://openrouter.ai/api/v1` has to be
written with a segment left off.

The model a request gets when it names none belongs to the upstream, not to the
request path: `default` for a server of your own, and for OpenRouter the model
named in `src/providers/openrouter.ts`.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `POST /v1/chat/completions` body | [schema/api/chat-request.json](schema/api/chat-request.json) | JSON body; `messages` non-empty; `stream` optional; `tools` and `tool_choice` optional, for callers that want a typed call back instead of prose; `temperature` and `seed` optional, and both reach the engine unchanged |
| `/v1/realtime` client events (WebSocket text frames) | [schema/api/realtime-client-event.json](schema/api/realtime-client-event.json) | audio only as the base64 PCM envelope, never binary frames |
| `PUT /v1/providers` body | [schema/api/providers-save.json](schema/api/providers-save.json) | JSON body; `providers` and `routes` are each optional and each replace the whole thing; a provider's `secret` left out keeps the stored key and an empty one clears it; every route names a provider in the same body |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| chat response (non-streaming) | [schema/api/chat-response.json](schema/api/chat-response.json) | one assistant message carrying whatever the engine produced: `content`, `tool_calls`, or both, with `finish_reason: "tool_calls"` whenever there is a call; `salvaged` counts the calls rebuilt from prose, and is absent when none was |
| chat SSE chunk (streaming, each `data:` payload) | [schema/api/chat-stream-event.json](schema/api/chat-stream-event.json) | token chunks with `finish_reason: null`, one chunk per completed tool call (`salvaged: 1` on it when the call was rebuilt from prose), one closing chunk with a finish reason, then literal `data: [DONE]` |
| realtime server events | [schema/api/realtime-server-event.json](schema/api/realtime-server-event.json) | `transcription.partial` per accepted append; `transcription.completed` on commit; `error` never closes the socket |
| error body (HTTP 4xx/5xx) | [schema/api/error.json](schema/api/error.json) | every non-2xx response carries this body; a 429 also carries a `Retry-After` header in whole seconds |
| `GET /health` | inline: `{status:"ok", service:"game-box", contractVersion}` | always 200 when the process is up |
| `GET /v1/providers`, and the answer to `PUT` | [schema/api/providers-config.json](schema/api/providers-config.json) | every provider, whether each is ready for a job, whether each key is set, and the routing. Never a key, masked or otherwise |
| `GET /v1/providers/{id}/health` | [schema/api/provider-health.json](schema/api/provider-health.json) | the verdict, whether the key is set, the status it answered with, and the milliseconds |
| `POST /v1/providers/{id}/test` | [schema/api/provider-test.json](schema/api/provider-test.json) | `ok` carries what the model wrote, the model that answered and the milliseconds; any other verdict carries why |
| `GET /v1/providers/{id}/models` | [schema/api/provider-models.json](schema/api/provider-models.json) | what it lists on `/v1/models`, each with the name it gave where it gave one |

## Providers, and which job goes where

Two families of engine:

- **external**: a hosted OpenAI-compatible service reached with a key. Base URL,
  model, and the name the key is stored under. OpenRouter is the one that ships;
  a second one (OpenAI, a gateway of your own) is another entry, not new code.
- **local**: an OpenAI-compatible server of your own (llama.cpp, ollama, vLLM).
  Host, port, model, no auth. It is never sent a credential, whatever else the
  environment holds. Inside a container `127.0.0.1` is the container, so name
  the machine (`host.docker.internal`) or the sibling service instead.

Five jobs can each be pointed at a provider: `history` (the city's history and
its charters, and the creation form writing a field for you), `city` (names,
signs, districts), `places` (interiors, people, things), `quests`, and
`dialogs` (talking to people in game).

A chat request names its own in `job`. A request that names none, or names one
nothing is assigned to, goes where `GAME_BOX_LLM_UPSTREAM` points, which is
where every request went before jobs existed. `job` is this service's field and
is never forwarded to an engine.

### The two files

| File | Holds | Mode | Override |
|---|---|---|---|
| `.env.local` beside `host/` | the keys, in environment format | 0600 | `GAME_BOX_SECRETS_FILE` |
| `.game-box.json` beside `host/` | the providers, their addresses and models, and the routing | the default | `GAME_BOX_CONFIG_FILE` |

Both are git-ignored and both are written by this service, through a neighbour
file renamed over the real one so a reader never sees half a key. Neither has
to exist: with no configuration file the registry holds one provider of each
family and no routing at all.

A variable already exported wins over the secrets file, as `.env` does, so a
machine that sets `OPENROUTER_API_KEY` itself is never overruled by something a
settings screen saved.

A key goes in through `PUT /v1/providers` and comes back out of nothing. `GET`
says whether each one is set, never what it is, and the response schema has no
field a key could sit in.

### Asking a provider

Three probes, each answering 200 with a verdict, because saying which state a
provider is in is what they are for:

- `ok`: it answered.
- `unreachable`: nothing answered.
- `refused`: it answered no, which is a wrong key or a model the account may not use.
- `busy`: rate-limited, not now.
- `misconfigured`: it was never asked, because its settings are incomplete.

`health` is one `GET /v1/models` and no generation, so it costs nothing to ask
often. `models` is that same listing read as a list of choices. `test` is one
real generation, uncapped like every other, answering with what the model
wrote, the model that answered and the milliseconds: it is what proves a
provider before a job is trusted to it.

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
engine's behalf. Measured on 2026-08-27 with `tools/repeatable.ts`'s question
and its pins (temperature 0, seed 20260823), sent one at a time:
`google/gemma-4-31b-it:free` through OpenRouter answered byte for byte the same
three times of three. That is one model on one provider on one day, not a
promise the hosted path makes: OpenRouter forwards `seed` to providers that
support it and says "determinism is not guaranteed for some models", and which
provider serves a free model can change under you.

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
  14 s each.

So a server of your own is sent the tool's parameters as `response_format`
and nothing of the tools themselves, and the JSON it writes is read back as
the call. OpenRouter is sent the choice itself, which it honours (see below).

### Why the tools stay out of that request

llama-server does not enforce a `response_format` grammar while `tools` ride
beside it, whatever the `tool_choice`. Measured on 2026-08-25 (b10603,
gemma-4-26b-a4b, `--jinja`) with the quest tool's 10.8 KB schema, the same
prompt and seed at temperature 0: step ids came back `step_001` and
`step_0005_a` against `^step_[0-9]{4,}$` with the tools sent, and
`step_0001` without them, four shapes each. Through the service with the tools
sent, 9 of 16 replayed quests and 2 of 4 in a live build came back as prose
the check refused on those ids, and 4 of 7 charter attempts in that build ran
past the caller's 300 s. So on this path the engine sees the parameters as the
grammar and the messages as they are, and nothing of the tool's `description`:
a caller says what it wants in its messages.

### What the grammar is handed

The schema in that `response_format` is the tool's parameters with every
`pattern` the engine's grammar cannot enforce exactly taken out, and the rest
spelled the way it reads them. The reply is still checked against the
parameters as written, so a pattern left out of the grammar is not left out of
the answer: a reply that breaks it stays prose.

Measured on 2026-08-25 against the same server, reading
`common/json-schema-to-grammar.cpp`:

- A character class goes into the string rule as it is, so a class that
  matches a quote (`[^{}]`, `.`) lets the model write the closing quote
  without closing the string. The grammar keeps both readings alive; once the
  reply drifts off the schema anywhere after that (a fourth item in an array
  of three, a rumour over its length), only the reading inside the string is
  left, and in it `}` can never be written again, so the reply runs until the
  context is full. The charter's `names` items carry
  `^(?:[^{}]|\{(?:family|adjective|noun)\})+$`: alone at the engine, with
  a two-item cap and a prompt asking for five, 3 of 3 seeds ran to the
  300-token probe cap with the pattern and 3 of 3 ended at about 45 tokens
  without it.
- An escape it does not know (`\d`, `\s`, `\w`) makes it accept any string.
- Whenever a pattern is present it ignores `minLength` and `maxLength`.

So a pattern is sent when it is anchored `^...$` and made only of literal
characters, escaped regex characters, classes that neither negate nor contain
a quote or a backslash, groups, alternation and quantifiers; `\d` is written
as `[0-9]`. Any other pattern is left out, and the string is bounded by its
`minLength` and `maxLength`, which the grammar does enforce.

Whatever the grammar will not hold the engine to is said to it instead, in
words, on the `description` of the field it applies to: a pattern that was left
out is quoted there as it was written, and the `minLength` and `maxLength` of a
field whose pattern stayed are said there too, because the grammar ignores
bounds beside a pattern. A rule taken out of the grammar and never said is a
rule the engine cannot keep: it breaks the check on the first attempt and only
hears why on the second. The reply is still checked against the parameters as
written, so this moves where the engine is told and never what it is held to.

Measured after, on 2026-08-25 through this service with `tools/replay.ts`,
on the requests a live build had sent (the charter whose attempt had run past
300 s, and a quest), each copy on its own seed, four at once: 16 of 16 charter
calls came back as the call and fit, 26 to 38 s; 16 of 16 quest calls came
back as the call and fit, 43 to 71 s four at once and 14 to 23 s one at a
time; 0 prose, nothing past a cap. Before, on the same engine the same day:
4 of 7 charter attempts in a live build ran past 300 s and 9 of 16 replayed
quests came back as prose.

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

## A caller that leaves

A client that closes its connection before the reply is done takes the
engine's work with it: the request to the upstream is aborted, and llama-server
frees the slot as the connection drops (measured: a slot processing a 5,787
token prompt was idle within a second of the client aborting). A reply that
runs away therefore costs the engine a slot only for as long as its caller
waits, never to the end of the context.

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

Measured on 2026-08-27 with the owner's key and the request shape the game
sends (`tools` plus a `tool_choice`, named and `required`), streamed and not,
against every tool-calling model the account lists.

- A forced call comes back as a call. `google/gemma-4-31b-it:free` answered
  `finish_reason: "tool_calls"` with a whole `name_city` call to all four
  shapes: named non-streamed (2,110 ms), `required` non-streamed (2,787 ms),
  `required` streamed (2,300 ms, the call arriving as an `id` plus `name`
  delta, then an `arguments` delta, then the finish chunk), and named streamed
  through this service's own parser (2,120 ms, `salvaged` false, so the model
  called rather than writing prose that had to be rebuilt). It is what the
  hosted upstream asks for when a request names no model.
- `z-ai/glm-5.2:free` and `poolside/laguna-s-2.1:free` answered a named choice
  with a whole call too, the second with prose beside it, which this service
  keeps both halves of. `google/gemma-4-26b-a4b-it:free` answered `required`
  with a call whose `knownFor` ran 500 tokens of one repeated word.
- A capped free model answers HTTP 429 with a JSON body (`"code": 429`,
  `limit_source: upstream_provider_shared_pool`, "temporarily rate-limited
  upstream, please retry shortly"). Most send no `Retry-After` header, so the
  wait a caller sees is this service's backoff; `z-ai/glm-5.2:free` puts
  `retry_after_seconds` in the body's metadata instead of the header. Every
  free model on the account spends long stretches in that state, several
  minutes at a time, and `openrouter/free` routes around it by picking
  whichever free model is answering.
- The rate limit also arrives inside a 200: `{"error":{"code":429}}` with no
  `choices` as the whole body, or as the first streamed payload. Both are
  answered as 429 `model-busy`.
- `openai/gpt-4o-mini` and `openai/gpt-4.1-mini` answer HTTP 404, "No endpoints
  available matching your guardrail restrictions and data policy". That is the
  account's privacy setting (openrouter.ai/settings/privacy), which leaves it
  10 models, 5 of them with tools and all free (`GET /models/user`). A paid,
  known tool-calling model cannot be measured from this account until that
  setting changes.
- OpenRouter prefixes a stream with `: OPENROUTER PROCESSING` comment lines and
  a non-streamed body with up to about 1 KB of whitespace while the provider
  thinks; both are skipped.

## Events

SSE stream for chat; WebSocket events for realtime, as listed in Outputs.

## Errors (closed set)

- HTTP 400 `invalid_request_error`: body not JSON, failed schema validation, a WebSocket endpoint asked for over plain HTTP, or a provider configuration that contradicts itself (two providers with one id, a route to a provider that is not in the same body).
- HTTP 404 `invalid_request_error`: no such endpoint, or no such provider.
- HTTP 405 `invalid_request_error`: wrong method for that endpoint.
- HTTP 413 `invalid_request_error`: request body over 8 MiB.
- HTTP 429 `rate_limit_error`, code `model-busy`: the upstream is rate-limited. `Retry-After` carries the seconds to wait, as described above.
- HTTP 500 `server_error`: a configuration file cannot be read or written. The path is named; nothing inside it is quoted back. A configuration file that will not parse is not a dead end: a `PUT` carrying both `providers` and `routes` keeps nothing from it and is written straight over it.
- HTTP 502 `server_error`: the LLM upstream engine failed before streaming started, or it is misconfigured (`GAME_BOX_LLM_UPSTREAM is not a URL`, `OPENROUTER_API_KEY is not set`, a provider a job was pointed at with no key).
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
- A credential is read from the environment or the secrets file, sent only to the provider it belongs to, and scrubbed out of every error and every verdict this service returns. It is never returned by any endpoint, masked or otherwise, and a provider that echoes it back part-masked (`sk-not-a************-key`, measured from OpenAI) has that scrubbed too: any run of six of its characters goes. A local provider, and a URL you configure yourself, are always called unauthenticated.
- A configuration file this service cannot read is reported by the configuration endpoint and never stops generation: a job with no readable assignment falls back to the environment.
- Tool definitions are forwarded to the engine unchanged, except where a call is forced through a grammar: there the tool's parameters are the grammar and nothing else of it is sent. A call the request insists on is asked for in the shape the upstream honours, and comes back in the OpenAI shape with its arguments as JSON text; when it was rebuilt from prose the reply says so. A caller that offers a tool gets either a complete call or an error, never a half-built one.
- A grammar is handed only what it enforces exactly; the reply is checked against the parameters as written.
- A caller that closes its connection ends the engine's work on its request.
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
| `src/providers` | [configuration](schema/providers/configuration.json) | the upstream a job goes to, or a verdict about one provider | two files beside `host/`: the keys 0600, everything else JSON |

The layers hand back a `Result` rather than throwing: `{ok: true, value}` or `{ok: false, error}` with a `code` from that layer's closed set (`invalid-request`, `upstream`, `busy`, `invalid-chunk`, `unknown-voice`, `invalid-entry`, `missing`, `integrity`, `unreadable`, `invalid-config`, `no-such-provider`, `unwritable`).

## How to modify this blackbox safely

Add endpoints and event types additively (minor contractVersion bump); never change the meaning of an existing field in place. Schemas are generated, so edit the zod object in `src/*/schema.ts` and run `pnpm -C host generate`; a stale `schema/` fails the tests. Swapping in a real engine (llama.cpp, sherpa-onnx, Kyutai Pocket TTS) is a change inside one layer folder as long as its schemas still validate. Run `pnpm -C host test` (the whole surface over real HTTP and a real WebSocket) and `pnpm -C host typecheck`; update this file and `schema/` in the same change.
