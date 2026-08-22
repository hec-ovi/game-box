# @gb/scribe contract

contractVersion: 0.1.0

## Purpose

The narrator backed by the local model: names, personalities, what people know and the quests they hand out, each one a forced tool call validated against the schema the tool was built from.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new Scribe(options?)` | `sidecar?`, `fallback?`, `seed?`, `attempts?` | defaults: a `Sidecar` on `GAME_BOX_URL` or `http://127.0.0.1:8976`, `OfflineNarrator` as the fallback, two attempts |

Scribe implements `@gb/forge`'s `Narrator`, so a `Forge` takes one and builds a city with it.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `nameCity`, `namePlace`, `describeNpc`, `describeItem` | the `Narrator` shapes | always answered: the fallback covers whatever the model cannot |
| `writeQuests` | quest documents, sealed | one call per quest, ready for `@gb/quest` to validate; the forge still drops any that do not hold up |
| `problems()` | `ScribeProblem[]` | every call that failed, so a thin world can be explained rather than guessed at |

## Errors (closed set)

`Scribe` records what `@gb/sidecar` returned:

- `unreachable`: the sidecar could not be contacted.
- `refused`: it answered with a non-2xx status.
- `no-tool-call`: the model wrote prose instead of calling the tool.
- `invalid-arguments`: the arguments failed the contract. The next attempt is told exactly which fields.

`Scribe` itself never fails: an unanswerable call falls through to the fallback narrator.

## Dependencies

- `@gb/kit` contract: contracts, results.
- `@gb/sidecar` contract (game/sidecar/CONTRACT.md): the client that makes the call.
- `@gb/forge` contract: the `Narrator` interface it implements and the `OfflineNarrator` it falls back to.
- `@gb/quest` contract: the quest draft shape a quest writer fills in.
- `@gb/world` contract: the closed vocabularies a narrator must choose from.


## Invariants

- The model is never asked for prose. Every call offers exactly one tool and names it in `tool_choice`, and the tool's parameters are the contract's own JSON Schema, so what defines the shape and what checks it cannot drift apart.
- A rejected call is retried once with the exact violations quoted back, then given up on. Two failures cost one name, never the world.
- Quests are written one per call: a small model writes a better single quest than a batch, and a failure costs one quest.
- Prompts live in `prompts/*.md` and are bundled into `src/prompts.generated.ts` by `pnpm --filter @gb/scribe run generate`. Edit the markdown, never the generated file.
- Nothing here decides geometry. The prompts say so, and the forge would ignore it anyway.

## How to modify this blackbox safely

A new authoring task is a new prompt file, a new contract, and a method that asks for it. Changing a prompt needs no code change, only a regenerate. Run `pnpm --filter @gb/scribe test`, which checks every outgoing request against the sidecar's own published `chat-request.json`.
