# gb-llm contract

contractVersion: 0.1.0

## Purpose

Turn a chat-message list into a stream of generated text tokens.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `request` | [schema/generate-request.json](schema/generate-request.json) | `messages` non-empty; roles limited to system/user/assistant |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| stream of `token-event` | [schema/token-event.json](schema/token-event.json) | zero or more `token` events, then exactly one `done` event; stream ends after `done` |

## Events

The output stream itself is the event surface; no other events.

## Errors (closed set)

- `InvalidRequest`: request failed schema validation. No stream is returned.
- `Upstream`: the configured upstream engine could not be reached or answered non-2xx. No stream is returned. Mid-stream upstream failures surface as a `done` event with `finishReason: "error"`.

## Dependencies

None (no other layer contracts).

## Invariants

- Every emitted event validates against `schema/token-event.json`; non-conforming events are dropped at the boundary (fail closed).
- Exactly one `done` event terminates every successful stream.
- No output-length cap is ever sent to any engine (no max_tokens or equivalent); generation ends naturally.
- Engine selection is internal: `GAME_BOX_LLM_UPSTREAM` set means proxy to that OpenAI-compatible server; unset means the deterministic stand-in (reply `You said: <last user message>`).

## How to modify this blackbox safely

Keep `generate(request) -> stream` as the single boundary. Additive schema changes (new optional request field, new event variant) bump the minor contractVersion and stay backward compatible. Swapping engines (llama.cpp via libllama, a different server) is a `src/`-only change as long as the schemas still validate. Run `cargo test -p gb-llm` before and after; update this file and `schema/` in the same change.
