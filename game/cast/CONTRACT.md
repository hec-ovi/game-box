# @gb/cast contract

contractVersion: 0.2.0

## Purpose

The people: one clip library and one dressed character per outfit, loaded once, cloned per NPC, wearing what their role suits, playing what the anchor they stand on implies, and turning their head when somebody talks to them.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Cast.load({ anims, wardrobe, characters })` | `anims`: the `anims.glb` buffer; `wardrobe`: `wardrobe.json` parsed to a value; `characters`: one GLB buffer per wardrobe id | every file carries the canonical 65-joint skeleton, in order; `tools/check-rig.mjs` is the gate |
| `cast.theme = string` | the world's theme, plain words | set it before the scene is built; it steers which outfits suit |
| `spawn(npc, doing?)` | a `@gb/world` `Npc`, a clip name | `npc.role` and `npc.appearance.base` come from the world vocabulary |
| `update(seconds)` | frame time | call once a frame, before rendering |
| `member.play(clip, fade?)` / `member.gesture(clip, fade?)` / `member.stopGesture(fade?)` | clip names | unknown names are ignored |
| `member.lookAt(point)` / `member.lookAway()` | a `THREE.Vector3` in world space | |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `spawn` | `CastMember`: `object`, `outfit`, `play`, `playing`, `gesture`, `stopGesture`, `gesturing`, `lookAt`, `lookAway` | a dressed person at the origin facing north, already animating, with their own skeleton and mixer |
| `clips()` / `characters()` / `has(clip)` | names | what the loaded pack can actually do |
| `Cast.doingAt(anchorKind)` | a clip name | every anchor kind maps to a clip that exists |
| `parseWardrobe(value)` | `Wardrobe`: `{ characters: WardrobeEntry[] }` | throws rather than returning a wardrobe the game cannot use |
| `chooseCharacter(wardrobe, npc, theme)` | a `WardrobeEntry` | always returns one: nobody is naked |
| `CastDressing` | a `@gb/scene` `Dressing`, plus `members()` | real people, everything else delegated to the greybox |

## Errors (closed set)

`CastError` (an `Error` with a `code`), thrown by `Cast.load` and `parseWardrobe` only:

- `unreadable-asset`: a GLB in the pack could not be parsed. Carries which file.
- `bad-wardrobe`: `wardrobe.json` is not the shape the build writes.
- `missing-character`: the wardrobe names a character whose file was not handed to `load`.

Everything after loading is forgiving: an unknown clip or gesture name is ignored rather than thrown, so a missing clip is a dull NPC, never a crash.

## Dependencies

- `@gb/world` contract: `Npc`, `BODY_KINDS`, `ANCHOR_KINDS`, `NPC_ROLES`.
- `@gb/scene` contract: the `Dressing` seam.
- `three`.

## The pack this box loads

Built by `node tools/build-anims.mjs && node tools/build-pack.mjs && node tools/build-wardrobe.mjs`, served from `assets/dist/`:

- `anims.glb`: every clip, no meshes.
- `wardrobe.json`: `{ characters: [{ id, body, file, roles, themes }] }`.
- `characters/<id>.glb`: one finished person, body and clothes already merged.

Dressing happens in the build, never at runtime: the outfit parts are refitted to the body's rest pose, moved onto its skin, and the body geometry under the clothes is dropped. There is no `SkinnedMesh.bind` call anywhere in this box.

## Invariants

- One clip library and one character mesh per outfit for the whole game; a person is a clone sharing that geometry with their own skeleton and their own mixer.
- Everybody is dressed. If no outfit is cut for a body, one cut for another body is used rather than sending somebody out bare.
- The same NPC id gets the same outfit and the same point in the loop every time the city is opened, so a shared world file looks the same to everyone.
- Every name in `CLIP_FOR_ANCHOR` and `CLIPS` is in the shipped library, and the tests fail if one goes missing, so a renamed clip is caught at build time rather than as a T-posing NPC.
- The head-look and gesture layers run after the mixer and never replace the base clip: the head turns off the pose the clip left, and a gesture adds to it on the upper body only.
- The head stays inside about 77 degrees of yaw and 46 of pitch off the clip's own pose, and eases in and out over about a fifth of a second.

## Adding an outfit

1. Put the parts somewhere under `assets/src/`. Each part is a glTF skinned to the canonical 65-joint skeleton, and covers a region of the body (torso, arms, legs, feet). A rest pose a few centimetres off this body's is fine: the build refits it.
2. Add an entry to `game/cast/wardrobe.json`:

```json
{
  "id": "male-dockhand",
  "body": "male",
  "dir": "my-pack/extracted/Parts",
  "parts": ["Male_Dockhand_Body", "Male_Dockhand_Arms", "Male_Dockhand_Legs", "Male_Dockhand_Feet"],
  "roles": ["worker", "courier"],
  "themes": ["harbour", "industrial"]
}
```

`roles` are `@gb/world` `NPC_ROLES`; `themes` are words looked for in the world's theme text. An outfit made for the NPC's role scores 2, a theme word scores 1, and the best score wins; ties are broken by the NPC's id. Give an outfit no roles and no themes and it becomes a fallback that only gets worn when nothing else fits the body.

3. Run `node tools/build-wardrobe.mjs`, then `node tools/check-rig.mjs <a body gltf> assets/dist/characters/*.glb`.

The build refuses an outfit whose joints are not the canonical skeleton in the canonical order, and one whose clothes stop below the bare neck the body keeps, which would leave a gap.

## How to modify this blackbox safely

New clips go in the library and in `CLIPS` or `CLIP_FOR_ANCHOR` together. New bodies need a `BODY_KIND` in `@gb/world` first, then a body file in `game/cast/wardrobe.json` and at least one outfit for it. Rebuild the pack, run the gate, then `pnpm --filter @gb/cast test`.
