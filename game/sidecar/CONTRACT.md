# @gb/sidecar contract

contractVersion: 0.3.0

## Purpose

The client for the local AI sidecar: ask it for one checked answer, or stream a spoken reply with the actions the speaker takes. No call can hang, and a busy model is waited out instead of hammered.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new Sidecar(options?)` | `base?`, `model?`, `fetch?`, `timeouts?`, `backoff?`, `onBusy?` | base defaults to `GAME_BOX_URL` or `http://127.0.0.1:8976`; `fetch` is injectable, so this runs in a browser, in Node and in a test; `timeouts` and `backoff` set this client's defaults; `onBusy` is told before every wait on a busy model |
| `ask(contract, options)` | a `@gb/kit` `Contract`, plus system text, user text, a tool name and description, and optionally `seed`, `temperature`, `signal` and `timeoutMs` | the contract's JSON Schema becomes the tool's parameters |
| `converse(options)` | system text, the messages so far, the tools the speaker may call now, and optionally `seed`, `temperature`, `signal`, `firstTokenMs` and `idleMs` | offering no tools means the speaker can only talk |

Both send the sidecar's own `POST /v1/chat/completions` shape (host/CONTRACT.md), and the tests check every outgoing request against its published `chat-request.json`.

`seed` (0 to 4294967294) and `temperature` go on the wire exactly when a call names them, on every call, `ask` and `converse` alike. A call that names neither sends neither, and the engine's own defaults decide. Whether the engine repeats itself for a pinned call is the engine's business; this box only carries the pin.

## Stopping a call

Every call takes the caller's own `AbortSignal` and runs against a clock. Each number is a default on the `Sidecar`, overridable per call.

| Clock | Default | What it measures |
|---|---|---|
| `askMs` | 300 s | `ask`, request start to the last byte. A quest written by a local model was measured at 170 s, so this clears real work and still returns a stalled call in five minutes instead of never. |
| `firstTokenMs` | 60 s | `converse`, request start to the first byte. Covers the connection and prompt processing, which is the slow part on a cold local model. |
| `idleMs` | 30 s | `converse`, the longest gap between two pieces of a reply that is already flowing. Tokens arrive tens of milliseconds apart. |

A streamed reply is never judged on its total length: the gap clock restarts when bytes land and again when the consumer comes back for more, so a long answer runs as long as it keeps moving.

Node's fetch keeps clocks of its own: undici gives up 300 s after the request and 300 s between two pieces of the body, and calls either one a broken connection. So on Node every call carries a dispatcher of its own with both of those set to twice the deadline that call runs against. The box's own clock is then always the first to fire, whatever `askMs` is set to, and a call that outlives it comes back as `timeout`, which is worth retrying, never as `unreachable`, which is not.

The dispatcher is built from the class the running Node already uses and is handed to fetch per request. The host application's fetch keeps every setting it had, and a dispatcher it installed itself (a proxy, a mock) is left to do its job. A browser has none of this: no dispatcher is made, and nothing in the box imports `undici` or a `node:` module, so a browser build has nothing to pull in.

## A busy model

A rate-limited sidecar answers HTTP 429 (or an error body whose `code` is `model-busy`), with `Retry-After` when it knows how long. That is the normal path on a free tier, so the call is waited out and sent again, inside the same clock it was already running against.

| Setting | Default | What it does |
|---|---|---|
| `attempts` | 4 | How many times one call is sent before `busy` is reported, the first try included. |
| `baseMs` | 2 s | The first wait when the sidecar names no `Retry-After` (a `Retry-After` of zero counts as none); each later one doubles it (2, 4, 8 s). |
| `capMs` | 60 s | The longest wait the box sits through. A `Retry-After` past it is reported as `busy` at once, never waited for. |
| `jitter` | 0.25 | A random share of the wait added on top, so callers refused together do not come back together. The wait is never shorter than what the sidecar asked. |

The wait also has to fit inside what is left of the call's clock (`askMs`, or `firstTokenMs` for a stream). One that would not fit is not started: the caller hears `busy` right away with the seconds it is worth waiting, and decides. So a busy model can never turn into a `timeout`, and no call ever asks twice without a wait between.

`onBusy` fires before each wait with `{ attempt, retryAfter, waitMs }`, which is how a screen says the model is busy while the box waits rather than looking hung. The caller's signal cuts a wait short like any other part of the call, and is reported as `aborted`.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `ask` | `Result<T, SidecarError>` | `T` has already passed the contract; never prose, never a half call |
| `converse` | `Result<AsyncIterable<ConverseEvent>, SidecarError>` | `text` pieces in order, `call` for each action taken, one `end` with the reason, or one `error` if the reply broke off |

`ConverseEvent` is `text`, `call`, `end` or `error`. An `error` event carries a `SidecarError` and is terminal: nothing follows it.

An engine that dies mid-reply is reported as a failure, never passed off as an answer. The sidecar marks it `finish_reason: "error"`; a stream then ends with an `error` event carrying `broken`, after every piece of text that did arrive, and `ask` returns `broken` unless a complete call had already landed.

## Errors (closed set)

- `unreachable`: the sidecar could not be contacted.
- `refused`: it answered with a non-2xx status.
- `busy`: the model is rate-limited and the box has stopped waiting: the tries ran out, or the wait asked for is past `capMs` or past the call's own clock. Carries `retryAfter`, the seconds before it is worth asking again (the sidecar's own number, or the box's next step when it named none). Ask again after that, and tell the player meanwhile.
- `no-tool-call`: `ask` got prose instead of the call it demanded.
- `invalid-arguments`: the arguments failed the contract, pointing at the fields.
- `broken`: the engine behind the sidecar died mid-reply. What arrived before it is real; the answer is not. Retrying is reasonable.
- `timeout`: nothing came back in time. Carries `phase` (`response`, `first-token` or `token`) and the `ms` that ran out. Retrying is reasonable.
- `aborted`: the caller stopped the call. Never retry this one; someone decided it was no longer wanted.

## Dependencies

- `@gb/kit` contract: contracts and results.
- The local AI service (host/CONTRACT.md): chat completions with `tools` and `tool_choice`.

## Invariants

- `ask` offers exactly one tool and names it in `tool_choice`, so the answer is a typed value or an error, never text to parse.
- `converse` offers tools with `tool_choice: "auto"`: the speaker decides whether to act, and can only call what the caller passed in for this turn.
- A streamed call whose arguments do not parse is dropped, not guessed at.
- `timeout`, `aborted` and `unreachable` are three different answers. A rejected request is never reported as the wrong one, and the clock that decides is always this box's, never the transport's.
- A busy model is never retried tightly: every retry waits at least what the sidecar asked, and a wait that would outlive the call's clock is not started. `busy` is the only code a rate limit can come back as, so it is never mistaken for a dead sidecar.
- What a call pins (`seed`, `temperature`) reaches the wire unchanged, and what it leaves out is left out.
- A caller signal that is already aborted stops the call before a request goes out.
- A call that ends leaves nothing behind: the timer is cleared, the listener comes off the caller's signal, and the response body reader is cancelled. That holds when the stream finishes, when it breaks off, and when the caller walks away from it mid-reply.
- Nothing here knows what a quest, an NPC or a city is. It moves calls and text.

## How to modify this blackbox safely

Keep `ask` and `converse` as the whole surface. New request fields must exist in the service's `chat-request.json` first, or the tests will reject them. The busy tests run against a real server on a real socket and measure the gaps between calls, so a change to the schedule is a change to those numbers. A stream must be iterated to its end or broken out of; that is what releases the call. Run `pnpm --filter @gb/sidecar test`.
