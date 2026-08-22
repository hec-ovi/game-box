# @gb/sidecar contract

contractVersion: 0.1.0

## Purpose

The client for the local AI sidecar: ask it for one checked answer, or stream a spoken reply with the actions the speaker takes.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new Sidecar(options?)` | `base?`, `model?`, `fetch?` | base defaults to `GAME_BOX_URL` or `http://127.0.0.1:8976`; `fetch` is injectable, so this runs in a browser, in Node and in a test |
| `ask(contract, options)` | a `@gb/kit` `Contract`, plus system text, user text, a tool name and description | the contract's JSON Schema becomes the tool's parameters |
| `converse(options)` | system text, the messages so far, and the tools the speaker may call now | offering no tools means the speaker can only talk |

Both send the sidecar's own `POST /v1/chat/completions` shape (api/CONTRACT.md), and the tests check every outgoing request against its published `chat-request.json`.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `ask` | `Result<T, SidecarError>` | `T` has already passed the contract; never prose, never a half call |
| `converse` | `Result<AsyncIterable<ConverseEvent>, SidecarError>` | `text` pieces in order, `call` for each action taken, one `end` with the reason |

## Errors (closed set)

- `unreachable`: the sidecar could not be contacted.
- `refused`: it answered with a non-2xx status.
- `no-tool-call`: `ask` got prose instead of the call it demanded.
- `invalid-arguments`: the arguments failed the contract, pointing at the fields.

## Dependencies

- `@gb/kit` contract: contracts and results.
- The sidecar's `api` contract (api/CONTRACT.md): chat completions with `tools` and `tool_choice`.

## Invariants

- `ask` offers exactly one tool and names it in `tool_choice`, so the answer is a typed value or an error, never text to parse.
- `converse` offers tools with `tool_choice: "auto"`: the speaker decides whether to act, and can only call what the caller passed in for this turn.
- A streamed call whose arguments do not parse is dropped, not guessed at.
- Nothing here knows what a quest, an NPC or a city is. It moves calls and text.

## How to modify this blackbox safely

Keep `ask` and `converse` as the whole surface. New request fields must exist in the sidecar's `chat-request.json` first, or the tests will reject them. Run `pnpm --filter @gb/sidecar test`.
