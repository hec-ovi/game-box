# @gb/cast contract

contractVersion: 0.7.0

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
| `Cast.doingAt(anchorKind, npcId?)` | a clip name | every anchor kind maps to clips that exist; with an id, which one is drawn off the id, so the same person always does the same thing |
| `CLIPS_FOR_ANCHOR` | one or more clip names per anchor kind | what a stance may look like |
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

- `anims.glb`: every clip, on one skeleton, no meshes. 0.99 MB over the wire.
- `wardrobe.json`: `{ characters: [{ id, body, file, roles, themes, styles, brows, beard? }] }`.
- `characters/<id>.glb`: one finished person, body, clothes, every hairstyle and both pairs of eyebrows already merged.

Dressing happens in the build, never at runtime: the outfit parts and the hair are refitted to the body's rest pose, moved onto its skin, and the body geometry under the clothes is dropped. There is no `SkinnedMesh.bind` call anywhere in this box. `spawn` only shows one hairstyle and one pair of eyebrows out of the ones the file already carries, and puts a colour on them.

The clothes are recut fantasy art. The only CC0 wardrobe on this skeleton is Quaternius's fantasy outfits pack, four outfits on two texture sheets, so the build takes them apart: belts, bracers and pauldrons are separate nodes and are not worn, the knee boots are cut off above the shoe and the trousers taken down over them, and every fabric on the sheet is repainted per outfit. What the pack painted on as hardware is settled into the cloth around it. `tools/wardrobe/` holds that work; `game/cast/wardrobe.json` is what it reads.

## What the library holds

Twenty-eight clips, all on the canonical skeleton, all CC0. `tools/build-anims.mjs` reads `clipsUsed()` out of `src/clips.ts` and ships that list and nothing else, so a clip nobody names is not in the file.

| Clip | What it is | Where it comes from |
|---|---|---|
| `Idle_Loop` | standing, weight shifting | Quaternius UAL1 |
| `Idle_FoldArms_Loop` | standing, arms folded | Quaternius UAL2 |
| `Idle_TalkingPhone_Loop` | standing, phone at the ear | Quaternius UAL2 |
| `Idle_Talking_Loop` | talking with the hands | Quaternius UAL1 |
| `Idle_No_Loop` | standing, shaking the head | Quaternius UAL2 |
| `Idle_Rail_Loop` | on the feet, hands on a surface at 1.02 to 1.04 m | Quaternius UAL2 |
| `Idle_Rail_Call` | the same, one arm up calling an order across it | Quaternius UAL2 |
| `Farm_Watering` | standing, head down, one hand working over something in front at about 1.05 m | Quaternius UAL2 |
| `Sitting_Idle_Loop` | sat, hands in the lap | Quaternius UAL1 |
| `Sitting_Talking_Loop` | sat, talking | Quaternius UAL1 |
| `Walk_Loop` | walking | Quaternius UAL1 |
| `Walk_Carry_Loop` | walking with something in both hands | Quaternius UAL2 |
| `Jog_Fwd_Loop` | jogging | Quaternius UAL1 |
| `Driving_Loop` | sat at a wheel | Quaternius UAL1 |
| `PickUp_Table` | taking something off a surface | Quaternius UAL1 |
| `Interact` | handing something over | Quaternius UAL1 |
| `Idle_Wall_Loop` | propped on a wall, arms folded | posed here, from `Idle_FoldArms_Loop` |
| `Idle_WallCross_Loop` | propped on a wall, one ankle hooked behind the other | posed here, from `Idle_Loop` |
| `Idle_WallSmoke_Loop` | propped on a wall, one hand up at the mouth | posed here, from `Idle_Loop` |
| `Idle_WallPhone_Loop` | propped on a wall, phone at the ear | posed here, from `Idle_TalkingPhone_Loop` |
| `Idle_Browse_Loop` | standing, chin down on what is in front of them | posed here, from `Idle_Loop` |
| `Idle_Bench_Loop` | hands on the top, chin down over the work | posed here, from `Idle_Rail_Loop` |
| `Sitting_Desk_Loop` | sat, leaning in, both hands out on the desk | posed here, from `Sitting_Idle_Loop` |
| `Sleep_Loop` | on their back on the mattress, breathing | blended here: `LayToIdle` held on its first frame, `Idle_Loop`'s breathing over it |
| `Sitting_Drink_Loop` | sat, raising a glass to face height and putting it down | blended here: `Sitting_Idle_Loop` under `Consume` |
| `Sitting_Phone_Loop` | sat, phone at the ear | blended here: `Sitting_Idle_Loop` under `Idle_TalkingPhone_Loop` |
| `Idle_Drink_Loop` | standing, raising a glass to face height and putting it down | blended here: `Idle_Loop` under `Consume` |
| `Idle_Yes_Loop` | standing, nodding | blended here: `Idle_Loop` under the nod out of `Yes` |

The two Quaternius Universal Animation Libraries carry 84 clips between them and are the only CC0 source on this skeleton; the 68 the game does not name are left out of the pack. Twelve of the twenty-eight are made here, out of clips those packs do have, in two ways:

- **A pose** holds some bones at an angle for the whole of a clip (`tools/anims/poses.mjs`, `derive.mjs`). Neither pack has a wall lean, so a standing idle gets its trailing leg brought forward to match the leading one, the body tipped 8 degrees back off both ankles, the soles levelled and the chin brought down. The source clip's own breathing and weight shift come through untouched, so a propped body is still moving.
- **A blend** lays one clip's movement over another clip's stance (`tools/anims/blends.mjs`, `blend.mjs`), which is the sum the gesture layer does at runtime, done once at build time: `result = stance * (reference^-1 * movement)`. Measured from the movement's own first frame it adds the movement alone, so a seated body drinks; measured from a plain standing idle it also carries the pose, so a seated body gets a phone to its ear. `hold` freezes the stance at one moment, which is how a clip that only passes through lying on the floor becomes a clip that stays there.

Neither can invent a limb the source never moves: there is no free clip of hands working a stove, a keyboard or a counter service, so those stances are held poses with the source's own breathing rather than real work.

### Which stance draws from which

| Anchor kind | Clips |
|---|---|
| `stand` | `Idle_Loop`, `Idle_FoldArms_Loop`, `Idle_TalkingPhone_Loop`, `Idle_Drink_Loop` |
| `lean` | `Idle_Wall_Loop`, `Idle_WallCross_Loop`, `Idle_WallSmoke_Loop`, `Idle_WallPhone_Loop` |
| `browse` | `Idle_Browse_Loop`, `Idle_Loop`, `Idle_FoldArms_Loop` |
| `guard` | `Idle_FoldArms_Loop`, `Idle_Loop`, `Idle_TalkingPhone_Loop` |
| `serve` | `Idle_Rail_Loop`, `Idle_Rail_Call` |
| `work-bench` | `Idle_Rail_Loop`, `Idle_Bench_Loop` |
| `cook` | `Idle_Bench_Loop`, `Farm_Watering` |
| `sit` | `Sitting_Idle_Loop`, `Sitting_Talking_Loop`, `Sitting_Phone_Loop` |
| `sit-drink` | `Sitting_Drink_Loop`, `Sitting_Talking_Loop`, `Sitting_Idle_Loop` |
| `work-desk` | `Sitting_Desk_Loop`, `Sitting_Phone_Loop`, `Sitting_Idle_Loop` |
| `sleep` | `Sleep_Loop` |

A shelf's first clip is the plainest reading of that stance, because it is what `Cast.doingAt(kind)` answers with nobody in mind.

`lean` is propped on a wall: back to it, hands free, feet out in front. It is not the rail stance, which is `serve`, `work-bench` and `cook`.

### What may be layered over a stance

`GESTURES` is `Idle_Talking_Loop`, `Sitting_Talking_Loop`, `Idle_Yes_Loop` and `Idle_No_Loop`: the same conversation on two bodies, plus a nod and a shake of the head that go over any of them. A gesture is added to the pose the base clip holds, so only a clip that stays near its own starting pose can be one. A drink, a wave, and the pack's own `Yes` (which throws a hand up with the nod) are whole-arm movements: laid over a stance whose hands are already up they put a forearm through the head, which is why the nod is rebuilt here from the head and chest of `Yes` alone. `tests/pose.test.ts` measures every clip against every gesture, so a gesture that cannot be layered is caught rather than seen.

### Standing a body against a wall

A lean clip holds the body behind its own root, so a lean anchor is not at the wall. **The anchor goes 0.44 m out from the face of the wall, facing away from it.** That is the deepest point any of the twelve dressed characters reaches behind the root over the whole of any of the four clips (0.414 m, the back of the widest coat) with 2.6 cm to spare. The feet land about 0.48 m out. `game/cast/tests/pose.test.ts` measures it, so the number cannot drift without the suite saying so; `@gb/forge` carries its own copy, because it cannot import this box.

### Laying a body in a bed

A sleeping body lies along the way it faces and is **centred on its own root: 0.96 m of body either side of it**, crown one way and soles the other, so a sleep anchor goes at the middle of the mattress rather than at one end. The clip carries the height as well: it was authored lying on the floor and is lifted here so the lowest point of the widest coat rests on `METRICS.furniture.mattressHeight`, the same way the sitting clip puts a body's hips at seat height. Both numbers are measured on all twelve dressed characters in `tests/pose.test.ts`.

The bed `@gb/forge` places is 1.84 m of pad and a body with boots on is 1.90 m end to end, so it overhangs by about 3 cm at each end.

### Reaching a work surface

| Stance | Where the hands are | What it is drawn against |
|---|---|---|
| `serve`, `work-bench`, `cook` | wrists 1.02 to 1.04 m up, palms 0.97, and 0.02 to 0.13 m in front of the root | `serviceCounterHeight` and `worktopHeight`, both 1.0 |
| `work-desk` | wrists 0.78 m up, 0.20 to 0.24 m in front of the root | `tableHeight`, 0.75 |

`barCounterHeight` 1.1 carries no stance: it is the rail a customer stands at, and staff work the 1.0 shelf behind it.

## Invariants

- **One stance, several clips.** An anchor kind names a stance; the person's own id picks which of that stance's clips they do. Five people propped on one wall are four different idles, and the same id draws the same one every time the city is opened. A kind with one clip behaves as it always did.
- **Facing.** A spawned body at `rotation.y = 0` faces -Z, the way a three.js camera looks at heading 0. Set `object.rotation.y` to a heading and the person faces along it. The source art faces the other way in its own files; `spawn` holds it at half a turn inside the object the game moves, so nothing outside this box has to know.
- Nobody's foot goes through the floor and nobody floats: over every clip and every outfit the lowest point of a posed body sits within a centimetre of the ground the root stands on. `Sleep_Loop` is the one clip that carries its own height, resting on the mattress rather than on the floor.
- One clip library and one character mesh per outfit for the whole game; a person is a clone sharing that geometry with their own skeleton and their own mixer.
- Everybody is dressed. If no outfit is cut for a body, one cut for another body is used rather than sending somebody out bare.
- Nobody stands in the rest pose. `spawn` falls back to an idle when it is handed a clip the library has not got, and `load` refuses a library with no clips in it, so a typo is a wrong animation rather than a T-posing NPC.
- No limb ends up inside the head, through any clip the game plays or any gesture layered over it.
- Every material a character renders with carries its base colour texture, so nobody comes out the white of a missing map.
- Everybody has hair, or is bald on purpose: the hairstyle, the eyebrows, the beard and the colour of all three are drawn from the NPC's id, and the eyebrows always match the hair. Tinted materials are shared across the whole cast, so a crowd costs one material per colour per hair texture, not one per person.
- The same NPC id gets the same outfit, the same hair and the same point in the loop every time the city is opened, so a shared world file looks the same to everyone.
- Every name in `CLIPS_FOR_ANCHOR`, `CLIPS` and `GESTURES` is in the shipped library, because `clipsUsed()` is all three lists and the build ships exactly that; the tests fail if one goes missing, so a renamed clip is caught at build time.
- A stance is a clip, so the two working anchors are two bodies: `work-desk` sits in the chair with its hands out on the desk top, `work-bench` stands at the bench with its hands on the counter top. Both heights are measured against `METRICS.furniture` in the tests.
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

New clips go in `CLIPS`, `CLIPS_FOR_ANCHOR` or `GESTURES` and then in the pack: `node tools/build-anims.mjs` builds from `clipsUsed()`, so naming a clip there is what ships it, and a name no source pack has fails the build. A pose no pack has is written in `tools/anims/poses.mjs` as per-bone angles on a clip the library already holds (`tools/anims/derive.mjs` says what the angles mean), or in `tools/anims/blends.mjs` as one clip's movement laid over another's stance (`tools/anims/blend.mjs`). Blends are built before poses, so a pose may be authored on top of a blended clip. Every clip drives all 65 bones, and it has to: the character files' own rest poses sit a few millimetres off the animation mannequin's, so a clip that leaves a bone undriven leaves it wherever that file put it, which is 5 cm at a toe. A clip only belongs in `GESTURES` if it stays near its own starting pose: a gesture is added to whatever the base clip is holding, so a whole-body action layered on top folds an arm through the head. New bodies need a `BODY_KIND` in `@gb/world` first, then a body file in `game/cast/wardrobe.json` and at least one outfit for it. Rebuild the pack, run the gate, then `pnpm --filter @gb/cast test`.
