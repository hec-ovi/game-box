# @gb/bundle contract

contractVersion: 0.1.0

## Purpose

The file a city travels in: world, quests and the art packs it needs, sealed behind one hash, plus the save that belongs to it.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Bundle.pack(world, quests, options?)` | a `@gb/world` `World`, validated quests | `options.requires` names the asset packs the renderer needs |
| `Bundle.open(value)` | [schema/bundle.json](schema/bundle.json) | any untrusted file, including one downloaded from a stranger |
| `Bundle.save(bundle, player, log)` | an opened bundle, `@gb/play` state, `@gb/quest` log | all three from the same session |
| `Bundle.resume(bundle, value)` | [schema/save.json](schema/save.json) | the save's content hash matches the bundle |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `pack` | [schema/bundle.json](schema/bundle.json) | `contentHash` covers everything else in the file |
| `open` | `{ world, quests, requires, contentHash }` | the world is sound and every quest is playable in it |
| `save` | [schema/save.json](schema/save.json) | carries the world id and the bundle's content hash |
| `resume` | `{ player, log }` | the log is open on exactly the steps it was saved on |

## Errors (closed set)

- `invalid-bundle`: not a bundle, or the world inside is not a world.
- `content-changed`: the hash does not match the contents. Someone edited the file; nothing is loaded.
- `unsound-world`: the world inside fails its integrity check.
- `broken-quest`: a quest inside cannot be played in this world. Carries which and why.
- `invalid-save`: not a save.
- `save-mismatch`: the save belongs to a different city or a different version of it.

## Dependencies

- `@gb/kit`, `@gb/world`, `@gb/quest`, `@gb/play` contracts.

## Invariants

- Nothing is trusted on the way in: shape, then hash, then world soundness, then every quest, in that order, and the first failure stops the load.
- The hash is over a stable serialisation, so two people who generated the same city get the same hash whatever order their keys ended up in.
- A save can only be resumed against the city it was made in, checked by id and by content hash, so ids can never silently point at different things.
- Asset packs are named and versioned in the file, so a missing or different pack is a loud failure rather than a city that renders wrong.
- Static world data and playthrough state never mix: sharing a bundle shares no progress.

## How to modify this blackbox safely

Adding a field to the bundle changes every hash, so it needs `schemaVersion: 2` and a migration that can still open version 1. Regenerate `schema/` (`pnpm --filter @gb/bundle run schema`) and run `pnpm --filter @gb/bundle test`.

`tests/fixtures/sealed-bundle.json` is a city sealed by this packer and kept as it was shared. It is never regenerated: it is the only proof that a file somebody already has still opens, still plays every quest in it, and still reseals to the hash it was shared with.
