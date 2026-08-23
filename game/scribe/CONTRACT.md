# @gb/scribe contract

contractVersion: 0.3.0

## Purpose

The narrator backed by the local model: names, whole places and the people in them, what those people know, and the quests they hand out, each one a forced tool call validated against the schema the tool was built from.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new Scribe(options?)` | `sidecar?`, `fallback?`, `seed?`, `attempts?`, `concurrency?`, `signal?`, `progress?` | defaults: a `Sidecar` on `GAME_BOX_URL` or `http://127.0.0.1:8976`, `OfflineNarrator` as the fallback, two attempts, as many calls at once as `GAME_BOX_SLOTS` says the engine has slots for (four if it says nothing), and no progress port |
| `writeInstances(requests)` | `InstanceRequest[]`: for each place its `kind`, the `theme`, the `rooms` its shell was cut into, the `posts` to fill (an id and a role each), the `things` lying about (an id and an archetype each), and the city's `premise` once there is one | the ids are the caller's own handles and come straight back on the answer; nothing about any other place may be in a request |
| `namePlaces(requests)` | `PlaceRequest[]`: a `kind` and the `theme` per building | for the buildings that do not open |

Scribe implements `@gb/forge`'s `Narrator`, so a `Forge` takes one and builds a city with it. `writeInstances` and `namePlaces` are the plural, fanned-out shapes of the same work and are not part of that interface yet.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `nameCity`, `namePlace`, `describeNpc`, `describeItem` | the `Narrator` shapes | always answered: the fallback covers whatever the model cannot |
| `writeInstances` | `Instance[]`, in the order the places were asked for | each one carries the place's `name`, its `character` (what the place is, empty when the model wrote none of it), one person per post with the post's own role, and one named thing per thing handed in. No two places in a city share a name, and nobody in a city shares a name with anybody else |
| `namePlaces` | names, in the order they were asked for | each one is a name nothing else in the city holds |
| `writeQuests` | quest documents, sealed | one call per quest, every one of them already accepted by `@gb/quest` against the city it was written for; a slot the model cannot fill is filled by the fallback narrator's quest for that slot, so a model that will not write never costs a quest the offline narrator would have written |
| `problems()` | `ScribeProblem[]` | every call that failed, so a thin world can be explained rather than guessed at |
| `progress` port | `ScribeProgress`: `stage` (`city`, `instances`, `quests`), `done`, `total`, `what` | published as each stage opens and each answer lands. Nothing reads it back, so a build with a loader writes the same city as one without, and a port that throws is dropped rather than failing the build |

## Errors (closed set)

`Scribe` records what the call came back as:

- `unreachable`: the sidecar could not be contacted.
- `refused`: it answered with a non-2xx status.
- `no-tool-call`: the model wrote prose instead of calling the tool.
- `invalid-arguments`: the answer did not hold up, either against the tool's own contract or, for a quest, against `@gb/quest` and the city it names, or for a place, against the posts and things it was handed. The next attempt is told exactly which fields.
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
- A place is written whole, in one call: what it is, everybody in it and everything lying about are one decision, because they are one decision in the world. That call is shown its own building and nothing else.
- A quest is checked here before it is handed over, against the same ids the model was shown. A draft that will not hold up goes back to the model with the reason; a slot it still cannot fill is written by the offline narrator. A build with the model on therefore never ends up with fewer quests than the same build with it off.
- Prompts live in `prompts/*.md` and are bundled into `src/prompts.generated.ts` by `pnpm --filter @gb/scribe run generate`. Edit the markdown, never the generated file.
- Nothing here decides geometry. The prompts say so, and the forge would ignore it anyway.

### A place written whole

`writeInstances` is one call per building. It is handed the city (its name, its
theme, its premise) and that building's own shell: the rooms it was cut into,
the posts to fill with the role at each one, and the things lying about with
the shape of each. It hands back the place's name, what the place is, one
person per post and one named thing per thing, and it never sees another
building, which is what lets a whole city's places be written at the same time.

The ids are the caller's: post ids and thing ids go out in the request and come
back on the answer, so the caller zips people onto anchors and names onto items
by id, never by the order they were written in. The tool's parameters are built
around the shell, so the only ids the model can decode are the ones it was
handed, there is exactly one answer for each of them, and the role is never
asked for, because which post is which job is a fact about the building.

### Unique names when nobody can see anybody else

Two places written at the same time cannot be told about each other, so they
cannot agree between themselves not to write the same person twice. The
agreement moves into the request instead.

- **People.** Each place is handed its own four letters of the alphabet, and the
  tool's schema will not decode a family name that starts with anything else.
  The alphabet is shuffled once per build and dealt out four at a time, so any
  six places in a row hold disjoint letters, which covers every wave the engine
  can serve. Two people can only collide if their family names collide, so
  inside that window a collision is not unlikely, it is unwritable.
- **Places and everything else.** Names are spent in index order once the wave
  has landed, never while it is in the air. The lower index keeps the name and
  the higher one is asked again with the taken names quoted at it; a second
  repeat is written by the fallback narrator rather than costing a third call.
  So which of two answers keeps a name is decided by the index it was asked at,
  and the same seed builds the same city whatever order the engine answered in.

### The corner of the city a quest is written about

A quest is shown eight places, which is small on purpose: a whole city in a
prompt is tokens spent on places the errand will never name. Eight places drawn
at random, though, are eight places with nothing between them. So the slice is a
neighbourhood: a seeded home, the places nearest its door, and the walk between
each of them and that door in metres, off the door positions the summary already
carries. About one in five swaps its furthest neighbour for the far side of the
city, so a town is not made entirely of errands you could run in a minute, and
the prompt says what the metres are for. Whatever else the slice holds, it
always holds somebody to hand the errand out and something to pick up.

A place the instance pass wrote is also shown as itself: the quest writer is
told what that bar is, in the words the bar's own agent used. The two are
matched on the place's name, which is the only handle the two passes share and
is unique across the city by the time either of them runs.

### Determinism, with more than one call in flight

Calls run in waves: `concurrency` of them go out together and all land before the next wave starts. That is the whole of the concurrency and the whole of the back-pressure, and it is what keeps the same seed producing the same city.

- Answers are reassembled by index, never by arrival.
- What a call is told about the answers before it is the previous waves' answers, never its own wave's, so it does not depend on which reply landed first.
- The corner of the city a quest is set in is drawn from the build's seed and the quest's index.

`writeInstances`, `namePlaces` and quest writing each fan out across the full width. `@gb/forge` still asks for names, people and things one at a time through the `Narrator` interface, and those run one call at a time until it moves to the plural shapes.

### The schema the model is handed

The quest draft's own JSON Schema is 41,994 characters, most of it the same six conditions and nine effects spelled out again inside every step kind. Two passes cut it to 10,779 before it goes on the wire, on every call:

- **Narrowed** to what the model can get right, because the schema is what it decodes against and a rule that lives only in the prompt is a rule it can walk past. Nothing a `WorldSummary` cannot name, so `stash` steps and going into an interior are cut. `next` is required on every step kind whose dead end the flow check refuses, and gone from the two that end a quest. Each step is in writing order: `kind` first, so a step commits to a mechanic before it writes the sentence the player reads, then the fields that kind needs, then `next`. Everything the narrowed schema still allows, the full draft contract accepts.
- **Written without repeats**: every subschema that appears more than once is hoisted into `$defs`. Dereference the result and the narrowed schema comes back exactly.

Validation always runs against `@gb/quest`'s own contract, never against the shortened copy.

### What each call knows about the city

A model cannot be specific about a world it cannot see. Every descriptive call is told the city's name and the names already spent, so the same city does not end up with four Vidals, and its people talk about the place they are standing in.

## How to modify this blackbox safely

A new authoring task is a new prompt file, a new tool in `src/tools.ts`, and a method that asks for it. A task that runs many at once also needs a `Pass` in `src/unique.ts`, which is what settles the names in index order. Changing a prompt needs no code change, only a regenerate. `GAME_BOX_SLOTS` is how many calls the engine behind the sidecar serves at once; llama-server reports it as `total_slots` and the sidecar does not pass it on, so it is set by hand or left at the default.

One file per job: `src/instance.ts` writes a place whole, `src/place-names.ts` names the buildings that do not open, `src/quests.ts` writes the work, `src/neighbourhood.ts` cuts the city into corners a quest can be written about, `src/claim.ts` deals out the family names, `src/unique.ts` settles which answer keeps a name, and `src/progress.ts` says how far it has got.

A length in a tool's schema is `@gb/world`'s own limit on the field the answer ends up in, never a limit on how much the model may write. The engine does not enforce `maxLength` anyway: it lets the answer run and the contract then throws the whole call away, which is why nothing has a cap the world does not already impose.

Run `pnpm --filter @gb/scribe test`, which checks every outgoing request against the service's own published `chat-request.json`.
