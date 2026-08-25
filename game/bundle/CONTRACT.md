# @gb/bundle contract

contractVersion: 0.5.0

## Purpose

The file a city travels in: world, quests and the art packs it needs, sealed behind one hash, brought up to what the format promises when it is older; the pack that adds to a finished city; and the save that belongs to it.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Bundle.pack(world, quests, options?)` | a `@gb/world` `World`, validated quests | `options.requires` names the art packs the renderer needs, each at the version the city was built against |
| `Bundle.open(value, have?)` | [schema/bundle.json](schema/bundle.json), `schemaVersion` 1 or 2, and the packs the reader has loaded | any untrusted file, including one downloaded from a stranger. `have` is the caller's own runtime, not file data, so it is taken as given |
| `Bundle.save(bundle, player, log)` | an opened bundle, `@gb/play` state, `@gb/quest` log | all three from the same session |
| `Bundle.resume(bundle, value)` | [schema/save.json](schema/save.json) | the save names this bundle's world id; its content hash may be another version's, see below |
| `Pack.cut(base, extended, options?)` | an opened bundle; a `City` `{ world, quests }`; `options.generator`, `options.version` | `extended.world` is the base's world grown by `@gb/forge`'s `extend` and `extended.quests` is the base's list with the quests written for the growth on the end. `extend` writes into the `World` it is given, so `base` is the file opened on its own, never the object that was grown |
| `Pack.apply(base, value, have?)` | an opened bundle; [schema/pack.json](schema/pack.json); the packs the reader has loaded | any untrusted pack file |
| `comparePacks(requires, have)` | two lists of `AssetPackRef` | none |
| `compareVersions(a, b)` | two version strings | none |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `pack` | [schema/bundle.json](schema/bundle.json) | `schemaVersion` 2: the world inside carries its charters and a `use` on every room, whatever the `World` held; `contentHash` covers everything else in the file |
| `open` | `{ world, quests, requires, packs, upgraded, contentHash }` | the world is sound, every plot's kind of place is declared in it, and every quest is playable in it. `upgraded` is true when the file was written before charters and the presets it was drawn with were written in on the way, see below |
| `save` | [schema/save.json](schema/save.json) | carries the world id, the bundle's content hash, and what each quest was called |
| `resume` | `{ player, log, report }` | against the same hash, the log is open on exactly the steps it was saved on and `report.dropped` is empty; against another version, everything that resolves is kept and the report says what was not |
| `cut` | [schema/pack.json](schema/pack.json) | names the base by world id and content hash; carries only what the extension added, the counters it minted up to and the cells it built on; `contentHash` covers everything else in the file |
| `apply` | an `OpenedBundle` of the extended city | its world is the one the pack was cut from byte for byte, every base record in it as it was, and its `contentHash` is the hash `Bundle.pack` gives that city, so the same base and the same pack open the same city on every machine |
| `comparePacks` | `PackReport`: `{ verdicts, asBuilt }` | one verdict per pack the file names, in the order it names them |
| `compareVersions` | `-1`, `0` or `1` | total: any two strings compare |
| `PUBLISHED`, `schemaText` | the bundle, the pack and the save, and the exact bytes their `schema/` files hold | what `run generate` writes and what the drift test reads |

## Errors (closed set)

- `invalid-bundle`: not a bundle, or the world inside is not a world. Carries the paths that failed, which is where a value the reader's build does not ship shows up.
- `content-changed`: the hash does not match the contents. Someone edited the file; nothing is loaded.
- `unknown-kind`: a plot or an interior is of a kind of place the file does not declare. Carries the words, sorted, each once. Nothing is loaded: that plot cannot be drawn at all.
- `unsound-world`: the world inside fails its integrity check.
- `broken-quest`: a quest inside cannot be played in this world. Carries which and why.
- `invalid-save`: not a save.
- `save-mismatch`: the save names another city's world id.
- `not-an-extension`: `cut` was handed a city that changed, moved or dropped something the base had. Carries each place by path (`plots.0`, `grid.21.23`, `quests.3`, `idCounters.plot`).
- `invalid-pack`: not a pack, or a pack naming a cell outside the base's grid. Carries the paths.
- `pack-mismatch`: the pack was cut from another city, or another version of this one. Carries the base it names and the base it was applied to.

`apply` also answers `content-changed` (the pack's hash), and every error `open` answers, because the extended city goes through the same gate a file does.

Art the reader does not have is not in this set. A city always opens; see below. A save from another version of this city is not in it either: it resumes, and the report says what it lost.

## What an import reports, and what it refuses

The stance is report, not refuse: a city opens whenever it can be drawn, and
`open` says what the reader should know about it. What it says:

- `packs`: how the reader's art stands against the art the file names, see "Opening a city whose art has moved on".
- `upgraded`: the file was written before charters and has been read against the presets it was drawn with, see "Opening a city written before charters".

What it refuses, in order, the first failure stopping the load: a document
that is not a bundle, a hash that does not match, a kind of place no charter
declares (`unknown-kind`), a world that is not sound, a quest that cannot be
played. A value outside the closed lists of the reader's build (a room use,
a finish, an anchor kind it does not ship) fails at `@gb/world`'s boundary as
`invalid-bundle` with the path, because the world schema is that build's own;
a file from a newer build fails there whole rather than half-loading.

`unknown-kind` is the one place the stance flips. A plot whose word names no
charter in the file, and none of the presets when the file declares nothing,
has no frontage, no rooms and no sign to draw from, so there is nothing to
report about it; the word is the whole message.

## Opening a city written before charters

A `schemaVersion` 1 file names each kind of place by one of the fourteen
preset words and carries no `charters`; its rooms carry no `use`. Every build
keeps those presets (`@gb/world`'s `SHIPPED_CHARTERS`), so the file still
reads, but it reads against a table in the reader's build, and a later build
could redraw it. So `open` makes it self-describing on the way in:

- `world.charters` is the fourteen presets, in the order the world normalises a declared list to;
- every room without a `use` gets one, off its label through the charter of the interior it is in (`roomUseOf`);
- `plot.kind`, `interior.kind` and everything else stay byte for byte as written.

The file on disk is not touched, and its identity is not either:
`contentHash` is the hash it was shared with, so every save written against
it resumes whole. `upgraded` is true. Packing the opened city again writes a
`schemaVersion` 2 file that carries the charters and the uses, hashes to a
new string, and opens with `upgraded: false` and nothing left to write:
writing the presets in is a fixed point. A version 2 file opened by a build
that reads only version 1 fails its schema instead of being drawn against
that build's presets, which is the fail-closed rule doing its job.

`pack` runs the same step over whatever `World` it is given, so a file it
writes is self-describing whether the world declared charters or was founded
on the presets alone.

## Adding to a finished city

A city is generated, played, and later added to as a separate authored step,
never while it is being played. `@gb/forge`'s `extend` grows a `World` in
place; the pack is what makes that growth a file anyone with the base can
apply and get the same city.

**What a pack holds.** The base's world id and content hash; the extended
city's `idCounters`; the grid cells the growth built on, each with what it
became; the charters and catalogues the growth declared that the base had
not; the plots, interiors, people, items and placements appended to the
base's lists, in the base's own record shapes; and the quests written for
the growth. Nothing of the base is in it.

**What `cut` holds the extended city to.** Every list the base had is a
prefix of the extended one, byte for byte; every charter and catalogue the
base declared is still declared unchanged; every counter is at or past the
base's; the only cells that differ were `empty` in the base; and everything
else in the document (name, seed, history, roads) is as written. Anything
else is `not-an-extension`, by path, and no pack is cut. Then the base plus
what was cut is rebuilt and compared with the extended city, so a pack that
would not give it back is never written.

**What `apply` does.** Shape, the pack's hash, then the base it names against
the base handed in, then the base document with the additions on the end and
the cells written, sealed as a `schemaVersion` 2 bundle and opened through
`open`. So a pack whose plot is of a kind neither the base nor the pack
declares is `unknown-kind`, one whose interior points at nothing is
`unsound-world`, and one whose quest cannot be played is `broken-quest`. A
pack's quests may name the base's places and people: they are validated
against the whole city. Ids continue from the base's counters, so nothing a
pack adds can collide with what the base has, and applying never writes into
the base handed in.

**Determinism.** The pack is a diff in the base's terms and the world reads a
document to the same bytes at both doors, so the same base and the same pack
give the same world, and the same `contentHash`, on every machine.

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

Three things, and only one of them is here.

**The envelope names the art.** `requires` is the renderer's shopping list:
pack, version, and the sha256 of the pack's own manifest. It is inside the
sealed body, so it is part of what the hash covers and cannot be edited under
the city. Naming a pack is what turns "your city looks different from mine"
into a named disagreement.

**The document pins the choices.** Which building model a plot got is a
per-plot fact on `@gb/world`'s `Plot.design`, not in this envelope. `open`
parses `doc.world` through `@gb/world`'s own schema, which strips every key
that box does not publish, so a pin smuggled into the envelope is gone before
the world is loaded.

**The document declares its places.** What a kind of place is (its frontage,
its rooms, its sign, its tint) is `world.charters`, and a version 2 file
always carries them, so no table in the reader's build can move a building.

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

- Nothing is trusted on the way in: shape, then hash, then every kind of place resolving to a charter, then world soundness, then every quest, in that order, and the first failure stops the load.
- The hash is over a stable serialisation, so two people who generated the same city get the same hash whatever order their keys ended up in.
- A save is resumed against the city it names by world id. Against the same content hash every id it carries resolves; against another version of the city an id that does not resolve is dropped and reported, never left pointing at a different thing, and a quest id is held to the title the save recorded.
- Resuming never writes: the save handed in is read, and what it loses is in the report rather than on disk.
- Opening never rewrites a city and never writes to disk. What comes out of `open` is the world that went into `pack`, byte for byte, with one addition for a file written before charters: the presets it was drawn with and the use of every room, written in so the file stops depending on a table in anybody's build. `plot.kind` is never changed, and the disagreement about art lands in `packs`.
- Art packs are named and versioned in the file, so a missing or different pack is a named answer rather than a city that quietly renders wrong.
- A kind of place is a fact about the file. A plot whose word the file does not declare is refused by name, never drawn as something else.
- Static world data and playthrough state never mix: sharing a bundle shares no progress.
- A pack only ever adds. `cut` refuses a city that changed anything the base had, `apply` appends to the base's lists and builds only on ground that was empty, and every base record comes out of `apply` byte for byte as it went in.
- A pack applies to the city it was cut from and no other, by world id and content hash.
- The published schemas are what this box generates today. Most of what is in them belongs to `@gb/world`, `@gb/quest` and `@gb/play`, so they go stale when one of those boxes adds a field and nothing here changes; `tests/published-schema.test.ts` is what notices, and it costs a file read.

## How to modify this blackbox safely

`schemaVersion` 2 is what `pack` writes; 1 is read and brought up to 2 on open (`src/self-describing.ts`). Adding a field to the envelope changes every hash, so it needs `schemaVersion: 3` and a step that can still open 1 and 2. The pack file is `schemaVersion` 1 (`src/pack/`): its record schemas are read off `@gb/world`'s, so a field the world adds reaches the pack without a line here moving. A field with a default anywhere in the world, quest or play schema changes the hash of every file written without it, so new fields there go on as optional; `tests/sealed.test.ts` is what notices. Regenerate `schema/` (`pnpm --filter @gb/bundle run generate`) and run `pnpm --filter @gb/bundle test`.

A change in `@gb/world`, `@gb/quest` or `@gb/play` also changes what this box publishes, without a line here moving. Run `pnpm --filter @gb/bundle run generate` and commit the result in the same change; the drift test will fail until you do.

`tests/fixtures/sealed-bundle.json` is a `schemaVersion` 1 city sealed by this packer before charters and kept as it was shared. It is never regenerated: it is the only proof that a file somebody already has still opens under the hash it was shared with, still plays every quest in it, and comes out carrying the presets it was drawn with and nothing else changed.
