# @gb/bundle contract

contractVersion: 0.3.0

## Purpose

The file a city travels in: world, quests and the art packs it needs, sealed behind one hash, plus the save that belongs to it.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Bundle.pack(world, quests, options?)` | a `@gb/world` `World`, validated quests | `options.requires` names the art packs the renderer needs, each at the version the city was built against |
| `Bundle.open(value, have?)` | [schema/bundle.json](schema/bundle.json), and the packs the reader has loaded | any untrusted file, including one downloaded from a stranger. `have` is the caller's own runtime, not file data, so it is taken as given |
| `Bundle.save(bundle, player, log)` | an opened bundle, `@gb/play` state, `@gb/quest` log | all three from the same session |
| `Bundle.resume(bundle, value)` | [schema/save.json](schema/save.json) | the save names this bundle's world id; its content hash may be another version's, see below |
| `comparePacks(requires, have)` | two lists of `AssetPackRef` | none |
| `compareVersions(a, b)` | two version strings | none |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `pack` | [schema/bundle.json](schema/bundle.json) | `contentHash` covers everything else in the file |
| `open` | `{ world, quests, requires, packs, contentHash }` | the world is sound and every quest is playable in it |
| `save` | [schema/save.json](schema/save.json) | carries the world id, the bundle's content hash, and what each quest was called |
| `resume` | `{ player, log, report }` | against the same hash, the log is open on exactly the steps it was saved on and `report.dropped` is empty; against another version, everything that resolves is kept and the report says what was not |
| `comparePacks` | `PackReport`: `{ verdicts, asBuilt }` | one verdict per pack the file names, in the order it names them |
| `compareVersions` | `-1`, `0` or `1` | total: any two strings compare |
| `PUBLISHED`, `schemaText` | the published formats, and the exact bytes their `schema/` files hold | what `run generate` writes and what the drift test reads |

## Errors (closed set)

- `invalid-bundle`: not a bundle, or the world inside is not a world.
- `content-changed`: the hash does not match the contents. Someone edited the file; nothing is loaded.
- `unsound-world`: the world inside fails its integrity check.
- `broken-quest`: a quest inside cannot be played in this world. Carries which and why.
- `invalid-save`: not a save.
- `save-mismatch`: the save names another city's world id.

Art the reader does not have is not in this set. A city always opens; see below. A save from another version of this city is not in it either: it resumes, and the report says what it lost.

## Resuming in a rebuilt city

A city built with the model on is a different city every time, same seed or
not, and a refresh rebuilds it. So a save whose hash is not the bundle's is
reconciled rather than refused: every id it names is looked up here, what
resolves is kept, what does not is dropped, and the save on disk is left as it
was.

| In the save | Kept when | Otherwise |
|---|---|---|
| money, flags, standing, the clock | always: they name nothing | |
| an inventory item | the item exists | dropped, its stolen mark with it |
| a companion | the person exists | dropped |
| a thing left somewhere | the item exists and the room still has that surface | dropped: the thing is back where the city file put it |
| where the player stands | outdoors, or the room exists | dropped: `where` reads nothing and the game starts them at the city's start |
| the tracked quest | the quest exists | dropped |
| a place or a person in the codex, a person's memories and disposition | the room or the person exists | dropped |
| a quest's progress | the quest exists and every step the record names is in it | dropped: the quest is unstarted and its giver offers it afresh |

A quest **exists** when this city has its id and, where the save recorded
titles, the same title. Ids are minted in order, so a rebuilt city hands
`quest_0001` to whatever it wrote first; the title is what tells that job from
this one. `save` writes `questTitles` for every quest in the set; a save from
before it resolves quests by id and steps alone.

`report` is `{ rebuilt, kept, dropped }`: `rebuilt` is whether the hash differed,
and `kept` and `dropped` list `{ kind, id }` once per named thing, in the order
the save listed them. `kind` is `item`, `companion`, `placed` (the item id),
`where` (the room, only when the save was indoors), `tracked`, `place`,
`person` (codex and memories together), or `quest` (only quests the player had
taken). Money, flags and standing are never listed because they are never
dropped. Against the same hash everything resolves, so `dropped` is empty and
the app has nothing to say.

## Opening a city whose art has moved on

`open` takes the packs the reader has actually loaded and reports how they stand
against the packs the file names. Refusing to open would be hostile, and opening
in silence is how a shared city gets quietly redrawn, so it opens and says what
it found.

| `state` | What it means | What the caller should do |
|---|---|---|
| `same` | name, version, and where both give one the hash, all agree | draw it |
| `newer` / `older` | the reader's copy of that pack is a different version | draw it; every pinned choice still names the same model, and anything the reader's pack has not got falls back to the kit |
| `altered` | same name and version, different bytes | draw it, and say so loudly: somebody's copy of the art is not the art |
| `missing` | the reader has no copy of that pack at all | draw it; what came from that pack falls back |

`asBuilt` is true only when the file names at least one pack and every one of
them reads `same`. A file that names nothing gets no verdicts and
`asBuilt: false`, because nothing can be promised about it: that is the honest
answer for every city exported so far.

## What a city has to record to replay the same for everybody

Two halves, and only one of them is here.

**The envelope names the art.** `requires` is the renderer's shopping list:
pack, version, and the sha256 of the pack's own manifest. It is inside the
sealed body, so it is part of what the hash covers and cannot be edited under
the city. Naming a pack is what turns "your city looks different from mine"
into a named disagreement.

**The document pins the choices.** Which building model a plot got is a
per-plot fact and belongs on `@gb/world`'s `Plot`, not in this envelope. This
box cannot hold it even if it wanted to: `open` parses `doc.world` through
`@gb/world`'s own schema, which strips every key that box does not publish, so
a pin smuggled into the envelope is gone before the world is loaded. It also
has to survive outside a bundle, because `Forge.extend` and `@gb/scene` are
handed a `World` and never a file.

Until that lands, `requires` is the whole of the promise: it tells a reader the
art is different, not which plots changed.

## The hash, and what it is for

`contentHash` is over the sealed body: the world document, the quests, the
packs the file names, and what generated it. It answers one question, "is this
the same city", and it is how `resume` knows whether a save is coming back to
the city it was written in or to a rebuilt one it has to be reconciled with.

It deliberately does not cover the bytes of the art. Folding an atlas hash into
it would give a city a new identity every time an unrelated texture was rebuilt,
and every save ever written against it would come back reconciled instead of
whole. The art is covered
where the art is: `requires[].sha256` against what the reader loaded, and each
pack's own internal hashes, which `@gb/prefab` already refuses to load past.

So the two together are the promise, and each is worthless alone: the hash says
the design is the one that was shared, the pack refs say the art drawing it is
the art it was designed against.

## Dependencies

- `@gb/kit`, `@gb/world`, `@gb/quest`, `@gb/play` contracts.

## Invariants

- Nothing is trusted on the way in: shape, then hash, then world soundness, then every quest, in that order, and the first failure stops the load.
- The hash is over a stable serialisation, so two people who generated the same city get the same hash whatever order their keys ended up in.
- A save is resumed against the city it names by world id. Against the same content hash every id it carries resolves; against another version of the city an id that does not resolve is dropped and reported, never left pointing at a different thing, and a quest id is held to the title the save recorded.
- Resuming never writes: the save handed in is read, and what it loses is in the report rather than on disk.
- Opening never rewrites the city. Whatever the reader's art turns out to be, the world that comes out of `open` is byte for byte the world that went into `pack`, and the disagreement lands in `packs` instead.
- Art packs are named and versioned in the file, so a missing or different pack is a named answer rather than a city that quietly renders wrong.
- Static world data and playthrough state never mix: sharing a bundle shares no progress.
- The published schemas are what this box generates today. Most of what is in them belongs to `@gb/world`, `@gb/quest` and `@gb/play`, so they go stale when one of those boxes adds a field and nothing here changes; `tests/published-schema.test.ts` is what notices, and it costs a file read.

## How to modify this blackbox safely

Adding a field to the bundle changes every hash, so it needs `schemaVersion: 2` and a migration that can still open version 1. Regenerate `schema/` (`pnpm --filter @gb/bundle run generate`) and run `pnpm --filter @gb/bundle test`.

A change in `@gb/world`, `@gb/quest` or `@gb/play` also changes what this box publishes, without a line here moving. Run `pnpm --filter @gb/bundle run generate` and commit the result in the same change; the drift test will fail until you do.

`tests/fixtures/sealed-bundle.json` is a city sealed by this packer and kept as it was shared. It is never regenerated: it is the only proof that a file somebody already has still opens, still plays every quest in it, and still reseals to the hash it was shared with.
