# @gb/scribe contract

contractVersion: 0.2.0

## Purpose

The narrator backed by the local model: names, personalities, what people know and the quests they hand out, each one a forced tool call validated against the schema the tool was built from.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new Scribe(options?)` | `sidecar?`, `fallback?`, `seed?`, `attempts?`, `concurrency?`, `signal?` | defaults: a `Sidecar` on `GAME_BOX_URL` or `http://127.0.0.1:8976`, `OfflineNarrator` as the fallback, two attempts, and as many calls at once as `GAME_BOX_SLOTS` says the engine has slots for (four if it says nothing) |

Scribe implements `@gb/forge`'s `Narrator`, so a `Forge` takes one and builds a city with it.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `nameCity`, `namePlace`, `describeNpc`, `describeItem` | the `Narrator` shapes | always answered: the fallback covers whatever the model cannot |
| `writeQuests` | quest documents, sealed | one call per quest, every one of them already accepted by `@gb/quest` against the city it was written for; a slot the model cannot fill is filled by the fallback narrator's quest for that slot, so a model that will not write never costs a quest the offline narrator would have written |
| `problems()` | `ScribeProblem[]` | every call that failed, so a thin world can be explained rather than guessed at |

## Errors (closed set)

`Scribe` records what the call came back as:

- `unreachable`: the sidecar could not be contacted.
- `refused`: it answered with a non-2xx status.
- `no-tool-call`: the model wrote prose instead of calling the tool.
- `invalid-arguments`: the answer did not hold up, either against the tool's own contract or, for a quest, against `@gb/quest` and the city it names. The next attempt is told exactly which fields.
- `timeout`: nothing came back in time. Tried again as it was.
- `aborted`: the caller stopped the call. Never tried again.

`Scribe` itself never fails: an unanswerable call falls through to the fallback narrator.

## Dependencies

- `@gb/kit` contract: contracts, results, the deterministic rng.
- `@gb/sidecar` contract (game/sidecar/CONTRACT.md): the client that makes the call.
- `@gb/forge` contract: the `Narrator` interface it implements and the `OfflineNarrator` it falls back to.
- `@gb/quest` contract: the quest draft shape a quest writer fills in, the validator every draft goes through, and the reward table the prompt is written from.
- `@gb/world` contract: the closed vocabularies a narrator must choose from.

## Invariants

- The model is never asked for prose. Every call offers exactly one tool and names it in `tool_choice`, and the tool's parameters come from the contract's own JSON Schema, so what defines the shape and what checks it cannot drift apart.
- Nothing caps how long an answer runs: no `max_tokens`, and no prompt asking for so many words.
- A rejected call is retried with the exact violations quoted back, then given up on. Two failures cost one name, never the world.
- Quests are written one per call: a small model writes a better single quest than a batch, and a failure costs one quest.
- A quest is checked here before it is handed over, against the same ids the model was shown. A draft that will not hold up goes back to the model with the reason; a slot it still cannot fill is written by the offline narrator. A build with the model on therefore never ends up with fewer quests than the same build with it off.
- Prompts live in `prompts/*.md` and are bundled into `src/prompts.generated.ts` by `pnpm --filter @gb/scribe run generate`. Edit the markdown, never the generated file.
- Nothing here decides geometry. The prompts say so, and the forge would ignore it anyway.

### Determinism, with more than one call in flight

Calls run in waves: `concurrency` of them go out together and all land before the next wave starts. That is the whole of the concurrency and the whole of the back-pressure, and it is what keeps the same seed producing the same city.

- Answers are reassembled by index, never by arrival.
- What a call is told about the answers before it is the previous waves' answers, never its own wave's, so it does not depend on which reply landed first.
- The corner of the city a quest is set in is drawn from the build's seed and the quest's index.

`@gb/forge` asks for names, people and things one at a time, so those run one wave at a time today. Quest writing is this box's own fan-out and uses the full width.

### The schema the model is handed

The quest draft's own JSON Schema is 41,994 characters, most of it the same six conditions and nine effects spelled out again inside every step kind. Two passes cut it to 10,779 before it goes on the wire, on every call:

- **Narrowed** to what the model can get right, because the schema is what it decodes against and a rule that lives only in the prompt is a rule it can walk past. Nothing a `WorldSummary` cannot name, so `stash` steps and going into an interior are cut. `next` is required on every step kind whose dead end the flow check refuses, and gone from the two that end a quest. Each step is in writing order: `kind` first, so a step commits to a mechanic before it writes the sentence the player reads, then the fields that kind needs, then `next`. Everything the narrowed schema still allows, the full draft contract accepts.
- **Written without repeats**: every subschema that appears more than once is hoisted into `$defs`. Dereference the result and the narrowed schema comes back exactly.

Validation always runs against `@gb/quest`'s own contract, never against the shortened copy.

### What each call knows about the city

A model cannot be specific about a world it cannot see. Every descriptive call is told the city's name and the names already spent, so the same city does not end up with four Vidals, and its people talk about the place they are standing in.

## How to modify this blackbox safely

A new authoring task is a new prompt file, a new tool in `src/tools.ts`, and a method that asks for it. Changing a prompt needs no code change, only a regenerate. `GAME_BOX_SLOTS` is how many calls the engine behind the sidecar serves at once; llama-server reports it as `total_slots` and the sidecar does not pass it on, so it is set by hand or left at the default.

Run `pnpm --filter @gb/scribe test`, which checks every outgoing request against the service's own published `chat-request.json`.
