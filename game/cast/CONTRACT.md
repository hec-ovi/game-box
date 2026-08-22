# @gb/cast contract

contractVersion: 0.1.0

## Purpose

The people: one clip library and one body per kind, loaded once, cloned per NPC, playing what the anchor they stand on implies.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Cast.load({ anims, bodies, outfits? })` | GLB buffers | every file carries the canonical 65-joint skeleton, in order; `tools/check-rig.mjs` is the gate |
| `spawn(npc, doing?)` | a `@gb/world` `Npc` | `npc.appearance.base` is a `BODY_KIND` the cast loaded |
| `update(seconds)` | frame time | |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `spawn` | `CastMember`: `object`, `play(clip)`, `playing` | a person at the origin facing north, already animating, with their own skeleton |
| `clips()` / `bodies()` / `outfits()` / `has(clip)` | names | what the loaded pack can actually do |
| `Cast.doingAt(anchorKind)` | a clip name | every anchor kind maps to a clip that exists |
| `CastDressing` | a `@gb/scene` `Dressing` | real people, everything else delegated |

## Errors (closed set)

Loading throws on an unreadable asset, because a game with no people is not a game. Everything after that is forgiving: an unknown clip name is ignored rather than thrown, so a missing clip is a dull NPC, never a crash.

## Dependencies

- `@gb/world` contract: `Npc`, `BODY_KINDS`, `ANCHOR_KINDS`.
- `@gb/scene` contract: the `Dressing` seam.
- `three`.

## Invariants

- One clip library and one body mesh per kind for the whole game; a person is a clone sharing that geometry with their own skeleton and their own mixer.
- Every name in `CLIP_FOR_ANCHOR` and `CLIPS` is in the shipped library, and the tests fail if one goes missing, so a renamed clip is caught at build time rather than as a T-posing NPC.
- People start at different points in the same loop, so a room of them is not one person copied.
- Clothes bind to the body's own skeleton; anything that renumbers joints is caught by the binding gate before it ships.

## How to modify this blackbox safely

New clips go in the library and in `CLIPS` or `CLIP_FOR_ANCHOR` together. New bodies need a `BODY_KIND` in `@gb/world` first. Rebuild the pack with `node tools/build-anims.mjs && node tools/build-pack.mjs && node tools/build-wardrobe.mjs`, then run the gate. Run `pnpm --filter @gb/cast test`.
