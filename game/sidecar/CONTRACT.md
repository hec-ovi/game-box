# @gb/sidecar contract

contractVersion: 0.2.0

## Purpose

The client for the local AI sidecar: ask it for one checked answer, or stream a spoken reply with the actions the speaker takes. No call can hang.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new Sidecar(options?)` | `base?`, `model?`, `fetch?`, `timeouts?` | base defaults to `GAME_BOX_URL` or `http://127.0.0.1:8976`; `fetch` is injectable, so this runs in a browser, in Node and in a test; `timeouts` sets this client's defaults |
| `ask(contract, options)` | a `@gb/kit` `Contract`, plus system text, user text, a tool name and description, and optionally `signal` and `timeoutMs` | the contract's JSON Schema becomes the tool's parameters |
| `converse(options)` | system text, the messages so far, the tools the speaker may call now, and optionally `signal`, `firstTokenMs` and `idleMs` | offering no tools means the speaker can only talk |

Both send the sidecar's own `POST /v1/chat/completions` shape (host/CONTRACT.md), and the tests check every outgoing request against its published `chat-request.json`.

## Stopping a call

Every call takes the caller's own `AbortSignal` and runs against a clock. Each number is a default on the `Sidecar`, overridable per call.

| Clock | Default | What it measures |
|---|---|---|
| `askMs` | 300 s | `ask`, request start to the last byte. A quest written by a local model was measured at 170 s, so this clears real work and still returns a stalled call in five minutes instead of never. |
| `firstTokenMs` | 60 s | `converse`, request start to the first byte. Covers the connection and prompt processing, which is the slow part on a cold local model. |
| `idleMs` | 30 s | `converse`, the longest gap between two pieces of a reply that is already flowing. Tokens arrive tens of milliseconds apart. |

A streamed reply is never judged on its total length: the gap clock restarts when bytes land and again when the consumer comes back for more, so a long answer runs as long as it keeps moving.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `ask` | `Result<T, SidecarError>` | `T` has already passed the contract; never prose, never a half call |
| `converse` | `Result<AsyncIterable<ConverseEvent>, SidecarError>` | `text` pieces in order, `call` for each action taken, one `end` with the reason, or one `error` if the reply broke off |

`ConverseEvent` is `text`, `call`, `end` or `error`. An `error` event carries a `SidecarError` and is terminal: nothing follows it.

## Errors (closed set)

- `unreachable`: the sidecar could not be contacted.
- `refused`: it answered with a non-2xx status.
- `no-tool-call`: `ask` got prose instead of the call it demanded.
- `invalid-arguments`: the arguments failed the contract, pointing at the fields.
- `timeout`: nothing came back in time. Carries `phase` (`response`, `first-token` or `token`) and the `ms` that ran out. Retrying is reasonable.
- `aborted`: the caller stopped the call. Never retry this one; someone decided it was no longer wanted.

## Dependencies

- `@gb/kit` contract: contracts and results.
- The local AI service (host/CONTRACT.md): chat completions with `tools` and `tool_choice`.

## Invariants

- `ask` offers exactly one tool and names it in `tool_choice`, so the answer is a typed value or an error, never text to parse.
- `converse` offers tools with `tool_choice: "auto"`: the speaker decides whether to act, and can only call what the caller passed in for this turn.
- A streamed call whose arguments do not parse is dropped, not guessed at.
- `timeout`, `aborted` and `unreachable` are three different answers. A rejected request is never reported as the wrong one.
- A caller signal that is already aborted stops the call before a request goes out.
- A call that ends leaves nothing behind: the timer is cleared, the listener comes off the caller's signal, and the response body reader is cancelled. That holds when the stream finishes, when it breaks off, and when the caller walks away from it mid-reply.
- Nothing here knows what a quest, an NPC or a city is. It moves calls and text.

## How to modify this blackbox safely

Keep `ask` and `converse` as the whole surface. New request fields must exist in the service's `chat-request.json` first, or the tests will reject them. A stream must be iterated to its end or broken out of; that is what releases the call. Run `pnpm --filter @gb/sidecar test`.
