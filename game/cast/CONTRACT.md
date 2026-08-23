# @gb/cast contract

contractVersion: 0.5.0

## Purpose

The people: one clip library and one dressed character per outfit, loaded once, cloned per NPC, wearing what their role suits and the hair their id draws, playing what the anchor they stand on implies, and turning their head when somebody talks to them.

The city is cyberpunk at night, so the clothes are near-black coated garments with one lit accent each, and the hair is as often dyed as grown. Twelve outfits cover the twelve `NPC_ROLES` across both bodies.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Cast.load({ anims, wardrobe, characters })` | `anims`: the `anims.glb` buffer; `wardrobe`: `wardrobe.json` parsed to a value; `characters`: one GLB buffer per wardrobe id | every file carries the canonical 65-joint skeleton, in order; `tools/check-rig.mjs` is the gate |
| `cast.theme = string` | the world's theme, plain words | set it before the scene is built; it steers which outfits suit |
| `spawn(npc, doing?)` | a `@gb/world` `Npc`, a clip name | `npc.role` and `npc.appearance.base` come from the world vocabulary |
| `update(seconds)` | frame time | call once a frame, before rendering |
| `member.play(clip, fade?)` / `member.stopGesture(fade?)` | clip names | an unknown name is ignored: they keep doing what they were doing |
| `member.gesture(clip, fade?)` | one of `GESTURES` | any other name is ignored, including a clip the library has |
| `member.lookAt(point)` / `member.lookAway()` | a `THREE.Vector3` in world space | |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `spawn` | `CastMember`: `object`, `outfit`, `play`, `playing`, `gesture`, `stopGesture`, `gesturing`, `lookAt`, `lookAway` | a dressed, barbered person at the origin facing -Z, already animating, with their own skeleton and mixer |
| `clips()` / `characters()` / `has(clip)` | names | what the loaded pack can actually do |
| `Cast.doingAt(anchorKind)` | a clip name | every anchor kind maps to a clip that exists |
| `GESTURES` | clip names | the clips that may be layered over another one |
| `parseWardrobe(value)` | `Wardrobe`: `{ characters: WardrobeEntry[] }`, each `{ id, body, file, roles, themes, styles, brows, beard? }` | throws rather than returning a wardrobe the game cannot use |
| `chooseCharacter(wardrobe, npc, theme)` | a `WardrobeEntry` | always returns one: nobody is naked |
| `CastDressing` | a `@gb/scene` `Dressing`, plus `members()` | real people, everything else delegated to the greybox |

## Errors (closed set)

`CastError` (an `Error` with a `code`), thrown by `Cast.load` and `parseWardrobe` only:

- `unreadable-asset`: a GLB in the pack could not be parsed, or the clip library has no clips in it. Carries which file.
- `bad-wardrobe`: `wardrobe.json` is not the shape the build writes.
- `missing-character`: the wardrobe names a character whose file was not handed to `load`.

Everything after loading is forgiving: an unknown clip or gesture name is ignored rather than thrown, so a missing clip is a dull NPC, never a crash.

## Dependencies

- `@gb/world` contract: `Npc`, `BODY_KINDS`, `ANCHOR_KINDS`, `NPC_ROLES`.
- `@gb/scene` contract: the `Dressing` seam.
- `three`.

## The pack this box loads

Built by `node tools/build-anims.mjs && node tools/build-pack.mjs && node tools/build-wardrobe.mjs`, served from `assets/dist/`:

- `anims.glb`: every clip, on one skeleton, no meshes.
- `wardrobe.json`: `{ characters: [{ id, body, file, roles, themes, styles, brows, beard? }] }`.
- `characters/<id>.glb`: one finished person, body, clothes, every hairstyle and both pairs of eyebrows already merged.

Dressing happens in the build, never at runtime: the outfit parts and the hair are refitted to the body's rest pose, moved onto its skin, and the body geometry under the clothes is dropped. There is no `SkinnedMesh.bind` call anywhere in this box. `spawn` only shows one hairstyle and one pair of eyebrows out of the ones the file already carries, and puts a colour on them.

The clothes are recut fantasy art. The only CC0 wardrobe on this skeleton is Quaternius's fantasy outfits pack, four outfits on two texture sheets, so the build takes them apart: belts, bracers and pauldrons are separate nodes and are not worn, the knee boots are cut off above the shoe and the trousers taken down over them, and every fabric on the sheet is repainted per outfit. What the pack painted on as hardware is settled into the cloth around it. `tools/wardrobe/` holds that work; `game/cast/wardrobe.json` is what it reads.

## Invariants

- **Facing.** A spawned body at `rotation.y = 0` faces -Z, the way a three.js camera looks at heading 0. Set `object.rotation.y` to a heading and the person faces along it. The source art faces the other way in its own files; `spawn` holds it at half a turn inside the object the game moves, so nothing outside this box has to know.
- One clip library and one character mesh per outfit for the whole game; a person is a clone sharing that geometry with their own skeleton and their own mixer.
- Everybody is dressed. If no outfit is cut for a body, one cut for another body is used rather than sending somebody out bare.
- Nobody stands in the rest pose. `spawn` falls back to an idle when it is handed a clip the library has not got, and `load` refuses a library with no clips in it, so a typo is a wrong animation rather than a T-posing NPC.
- No limb ends up inside the head, through any clip the game plays or any gesture layered over it.
- Every material a character renders with carries its base colour texture, so nobody comes out the white of a missing map.
- Everybody has hair, or is bald on purpose: the hairstyle, the eyebrows, the beard and the colour of all three are drawn from the NPC's id, and the eyebrows always match the hair. Tinted materials are shared across the whole cast, so a crowd costs one material per colour per hair texture, not one per person.
- The same NPC id gets the same outfit, the same hair and the same point in the loop every time the city is opened, so a shared world file looks the same to everyone.
- Every name in `CLIP_FOR_ANCHOR`, `CLIPS` and `GESTURES` is in the shipped library, and the tests fail if one goes missing, so a renamed clip is caught at build time.
- A stance is a clip, so the two working anchors play two of them: `work-desk` sits in the chair (`Sitting_Idle_Loop`), `work-bench` stands at the bench on the standing rail loop (`Idle_Rail_Loop`), which holds the hands at 1.02 to 1.04 m, the height `METRICS.furniture.serviceCounterHeight` is drawn at.
- The head-look and gesture layers run after the mixer and never replace the base clip: the head turns off the pose the clip left, and a gesture adds to it on the upper body only.
- The head stays inside about 77 degrees of yaw and 46 of pitch off the clip's own pose, and eases in and out over about a fifth of a second.

## Adding an outfit

Everything lives in `game/cast/wardrobe.json`. `partsDir` says where the garment glTFs are under `assets/src/`; each part is skinned to the canonical 65-joint skeleton and covers a region of the body. A rest pose a few centimetres off this body's is fine: the build refits it.

```json
{
  "id": "male-dockhand",
  "body": "male",
  "parts": [
    { "name": "Male_Ranger_Body", "drop": ["Male_Ranger_Body_Belt_1"], "paint": { "cloth": "ink", "leather": "ink", "stud": { "colour": "amber", "glow": 0.62 } } },
    { "name": "Male_Ranger_Legs", "hem": 0.23, "paint": { "cloth": "slate", "leather": "slate", "stud": "slate" } },
    { "name": "Male_Ranger_Feet_Boots", "cut": 0.27, "paint": { "cloth": "boot", "leather": "boot", "stud": "boot" } }
  ],
  "roles": ["worker", "courier"],
  "themes": ["docks", "industrial"]
}
```

Per part:

- `drop` names nodes not worn at all. The pack's belts, bracers and pauldrons go here.
- `cut` drops everything above that height in metres, which is how a knee boot becomes a shoe.
- `hem` pulls a garment's bottom rim down to that height, stretching its lowest 20 cm, which is how a trouser reaches the shoe the boot used to cover. Keep `hem` a little under the boot's `cut` so the cut rim tucks under the trouser.
- `paint` gives every fabric of that part's source sheet a colour from the `fabrics` block. A rule may instead be `{ colour, flatten, glow }`: `flatten` pulls the fabric towards one even tone (that is how painted-on hardware is erased), and `glow` makes it the one lit accent the person carries. `tools/wardrobe/fabrics.mjs` names the fabrics each source sheet is made of and how much each settles by default.

`finish` sets the roughness and metalness every garment renders with: low roughness and a trace of metal is what makes them read as coated rather than woven.

`roles` are `@gb/world` `NPC_ROLES`; `themes` are words looked for in the world's theme text. An outfit made for the NPC's role scores 2, a theme word scores 1, and the best score wins; ties are broken by the NPC's id. Give an outfit no roles and no themes and it becomes a fallback that only gets worn when nothing else fits the body.

Then run `node tools/build-wardrobe.mjs`, then `node tools/check-rig.mjs <a body gltf> assets/dist/characters/*.glb`.

The build refuses an outfit whose joints are not the canonical skeleton in the canonical order, one whose clothes stop below the bare neck the body keeps, and one that leaves a fabric of its source sheet unpainted.

## Adding a hairstyle

Hair is listed per body in the `hair` block of `game/cast/wardrobe.json`: `styles` are the pieces to offer, `brows` is the second pair of eyebrows, `beard` is the one beard. Each file is a glTF skinned to the canonical skeleton (the pack's "Rigged to Head Bone" export), and the build refits it to this body's head the same way it refits clothes. Colours live in `src/look.ts` with a weight each, so the mix of grown and dyed is one edit; they multiply a greyscale strand map, so they read brighter than the hair they make.

## How to modify this blackbox safely

New clips go in the library and in `CLIPS`, `CLIP_FOR_ANCHOR` or `GESTURES` together. A clip only belongs in `GESTURES` if it stays near its own starting pose: a gesture is added to whatever the base clip is holding, so a whole-body action layered on top folds an arm through the head. New bodies need a `BODY_KIND` in `@gb/world` first, then a body file in `game/cast/wardrobe.json` and at least one outfit for it. Rebuild the pack, run the gate, then `pnpm --filter @gb/cast test`.
