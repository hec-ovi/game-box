# @gb/cast contract

contractVersion: 0.11.0

## Purpose

The people: one clip library and one dressed character per outfit, loaded once, cloned per NPC, wearing what their role suits and the hair their id draws, built to the size their id draws, playing what the anchor they stand on implies with the thing that clip is posed around in their hand, leaving that stance to face whoever talks to them, and talking with their hands and their head for as long as their line is arriving.

The city is cyberpunk at night, so the clothes are near-black woven garments with one lit accent each, and the hair is as often dyed as grown. Twelve outfits cover the twelve `NPC_ROLES` across the pack's two bodies.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Cast.load({ anims, wardrobe, characters })` | `anims`: the `anims.glb` buffer; `wardrobe`: `wardrobe.json` parsed to a value; `characters`: one GLB buffer per wardrobe id | every file carries the canonical 65-joint skeleton, in order; `tools/check-rig.mjs` is the gate |
| `cast.theme = string` | the world's theme, plain words | set it before the scene is built; it steers which outfits suit |
| `spawn(npc, doing?)` | a `@gb/world` `Npc`, a clip name | `npc.role` and `npc.appearance.base` come from the world vocabulary |
| `update(seconds)` | frame time | call once a frame, before rendering |
| `member.play(clip, fade?)` / `member.stopGesture(fade?)` | clip names | an unknown name is ignored: they keep doing what they were doing. `play` ends an `attend` |
| `member.pace(metresPerSecond)` | the speed the body is really moving at | only a clip in `GAITS` is paced; anything else is left alone |
| `member.gesture(clip, fade?)` | one of `GESTURES` | any other name is ignored, including a clip the library has |
| `member.speak(on)` / `member.pulse()` | a boolean; nothing | `speak(true)` opens a line and `speak(false)` closes it; `pulse` is a chunk of the reply arriving and does nothing while they are not speaking |
| `member.lookAt(point)` / `member.lookAway()` | a `THREE.Vector3` in world space | |
| `member.attend(point)` / `member.resume()` | a `THREE.Vector3` in world space | `attend` may be called again with a new point; `resume` with nothing to resume does nothing |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `spawn` | `CastMember`: `object`, `outfit`, `build`, `play`, `playing`, `holding`, `pace`, `gesture`, `stopGesture`, `gesturing`, `speak`, `pulse`, `speaking`, `lookAt`, `lookAway`, `attend`, `resume`, `attending` | a dressed, barbered, built person at the origin facing -Z, already animating, with their own skeleton and mixer |
| `member.build` / `buildFor(npc)` | `Build`: `regular` or `heavy` | how the rig was scaled at spawn; `buildFor` answers it off the person alone, with no body to spawn |
| `member.speaking` | a boolean | true between `speak(true)` and `speak(false)`, whatever the clip under it |
| `member.holding` | a `THREE.Object3D` or undefined | the thing the playing clip is posed around, parented to their own bone; nothing for a clip that holds nothing |
| `clips()` / `characters()` / `has(clip)` | names | what the loaded pack can actually do |
| `Cast.doingAt(anchorKind, npcId?)` | a clip name | every anchor kind maps to clips that exist; with an id, which one is drawn off the id, so the same person always does the same thing |
| `CLIPS_FOR_ANCHOR` | one or more clip names per anchor kind | what a stance may look like |
| `CLIPS` | named clips: `idle`, `walk`, `run`, `talk`, `talkSeated`, `carry`, `pickUp`, `give`, `drive`, `standUp`, `sitDown` | the clips the game asks for outside the anchor table |
| `GAITS` | clip name to metres per second | every clip that moves a body along, at the ground speed it was authored for |
| `WALKS` / `walkFor(npcId)` | clip names | the walks a pedestrian may be given, and the one this person gets |
| `GESTURES` | clip names | the clips that may be layered over another one |
| `HANDHELD` | clip name to `{ prop, bone }` | which clips put something in a hand, and which hand |
| `parseWardrobe(value)` | `Wardrobe`: `{ characters: WardrobeEntry[] }`, each `{ id, body, file, roles, themes, styles, brows, beard? }` | throws rather than returning a wardrobe the game cannot use |
| `chooseCharacter(wardrobe, npc, theme)` | a `WardrobeEntry` | always returns one: nobody is naked |
| `CastDressing` | a `@gb/scene` `Dressing`, plus `members()` | real people; `building`, `prop`, `pickup`, `ground` and `surface` go to the dressing behind (the `Greybox` unless one is given) with everything the seam hands over, and `lights`, `marking` and `clutter` are there when that dressing has them |

## Errors (closed set)

`CastError` (an `Error` with a `code`), thrown by `Cast.load` and `parseWardrobe` only:

- `unreadable-asset`: a GLB in the pack could not be parsed, or the clip library has no clips in it. Carries which file.
- `bad-wardrobe`: `wardrobe.json` is not the shape the build writes.
- `missing-character`: the wardrobe names a character whose file was not handed to `load`.

Everything after loading is forgiving: an unknown clip or gesture name is ignored rather than thrown, so a missing clip is a dull NPC, never a crash.

## Dependencies

- `@gb/world` contract: `Npc`, `BODY_KINDS`, `ANCHOR_KINDS`, `NPC_ROLES`, `METRICS.furniture`, and what the seam hands through: `Plot`, `ResolvedCharter`, `FurnitureProp`, `Item`, `CellKind`.
- `@gb/scene` contract: the `Dressing` seam, `Greybox`, `BuildingSize`, `SurfacePart`, `SurfaceSize`.
- `three`.

## The pack this box loads

Built by `node tools/build-anims.mjs && node tools/build-pack.mjs && node tools/build-wardrobe.mjs`, served from `assets/dist/`:

- `anims.glb`: every clip, on one skeleton, no meshes. 1.31 MB over the wire, 47 clips.
- `wardrobe.json`: `{ characters: [{ id, body, file, roles, themes, styles, brows, beard? }] }`.
- `characters/<id>.glb`: one finished person, body, clothes, every hairstyle and both pairs of eyebrows already merged. Twelve files, 1.11 to 1.21 MB each, 14.01 MB together.

Dressing happens in the build, never at runtime: the outfit parts and the hair are refitted to the body's rest pose, moved onto its skin, and the body geometry under the clothes is dropped. There is no `SkinnedMesh.bind` call anywhere in this box. `spawn` only shows one hairstyle and one pair of eyebrows out of the ones the file already carries, and puts a colour on them.

Everything worn over the head and neck is then held outside the bare skin that is left (`tools/wardrobe/settle.mjs`): the packs are cut for a narrower body than this one, so a collar's rim sat up to 50 mm inside the nape and the neck came through the cloth in ragged holes. Each vertex is moved out along the skin's own normal until it is clear (10 mm for a garment, 3 mm for hair), and the move is smoothed over the piece's own edges first, so a buried rim opens as one piece instead of tearing into shards. Through the stance a person spawns in, on both builds, no cloth reaches more than 6 mm back inside the skin (`tests/looks.test.ts`).

The clothes are recut fantasy art. The only CC0 wardrobe on this skeleton is Quaternius's fantasy outfits pack, four outfits on two texture sheets, so the build takes them apart: belts, bracers and pauldrons are separate nodes and are not worn, the knee boots are cut off above the shoe and the trousers taken down over them, and every fabric on the sheet is repainted per outfit. What the pack painted on as hardware is settled into the cloth around it. `tools/wardrobe/` holds that work; `game/cast/wardrobe.json` is what it reads.

### The bodies

The Universal Base Characters pack ships two bodies, both on the canonical 65-joint skeleton, and everybody in the city is one of them:

| Body file, under `assets/src/quaternius-ubc/.../Base Characters/Godot - UE/` | Dresses |
|---|---|
| `Superhero_Male_FullBody.gltf` | `male` |
| `Superhero_Female_FullBody.gltf` | `female` |

This box never assigns a body: `npc.appearance.base` is the world's, and whatever it says is dressed from the outfits cut for that body (`chooseCharacter` in `src/wardrobe.ts`).

### The heavy build

Two bodies would put the same frame on every doorman in the city, so a minority of the people whose work is physical are built heavier at spawn: **`buildFor(npc)` is `heavy` for the 30 percent of guards, workers and mechanics whose id hashes into it**, and `regular` for everybody else. It is drawn off the id alone, so the same person is the same size every time the city is opened and on anyone else's machine, and `member.build` says which they are.

The build is the pack's own rig scaled, not a second mesh: the torso bones go 12 percent wider across, the upper arms 16, the shoulder joints sit 15 percent further out along the clavicles, and the whole body grows 4 percent about the root (`src/physique.ts`). Every bone's scale is cancelled by a group under it, so the scale reaches that bone's own skin and nothing below it: a thicker chest does not shear the arms swinging off it, and every clip plays as authored. The clip library carries no scale channel at all (`tools/anims/library.mjs` drops the packs' 2,925 channels that never leave 1, and refuses one that does), so nothing the mixer writes can undo a build.

Measured on one id spawned into both builds, in one outfit, on both bodies (`tests/build.test.ts`):

| | regular | heavy |
|---|---|---|
| height, male | 1.768 m | 1.838 m |
| height, female | 1.767 m | 1.837 m |
| shoulders across the skin, male | 0.477 m | 0.553 m |
| shoulders across the skin, female | 0.442 m | 0.502 m |
| upper-arm joints apart, male | 0.382 m | 0.451 m |
| chest off the spine | 1.00 | 1.13 |
| upper arm, thickness | 1.00 | 1.18 |
| head, thickness | 1.00 | 1.04, the height and no more |

Through all 47 clips the heavy body's lowest point stays within 12 mm of the regular body's (worst: the flight frame of `Sprint_Loop`), so the feet are on the floor, the soles on the stool's rail and the back on the mattress wherever the regular body's are. On a seat the taller body's hips ride at most 22 mm higher (worst: `Sitting_Desk_Loop`), which goes into the pad's give rather than into the air. Propped on a wall it stays inside the published 0.44 m standoff. What is in the hand goes where it goes on the regular body, within 3 cm: the wider shoulder carries the phone 27 mm further off the ear at worst and leaves the glass and the roll at the lips.

### The outfits

Twelve, six per body, cut from the fantasy pack's Peasant and Ranger parts and repainted, each with one lit accent. An NPC gets the one cut for their body that names their role, the theme breaking ties.

| Id | Garments | Accent | Roles | Theme words | MB |
|---|---|---|---|---|---|
| `male-office` | Peasant body and legs, Ranger arms, Peasant shoes | cyan | clerk, receptionist, resident | office, downtown, business, finance, tower | 1.19 |
| `male-service` | Peasant body, Ranger arms and legs, Peasant shoes | violet | bartender, cook, patron | bar, cafe, restaurant, hotel, nightlife | 1.19 |
| `male-casual` | Peasant body, arms, legs and shoes | lime | patron, resident, wanderer | city, neighbourhood, residential, suburb, quiet | 1.11 |
| `male-works` | Ranger body, arms and legs, Ranger boots cut to shoes | amber | worker, mechanic, resident | industrial, docks, works, depot, yard, construction | 1.16 |
| `male-courier` | Ranger body and arms, Peasant legs and shoes | magenta | courier, wanderer, patron | downtown, traffic, delivery, market, rush | 1.21 |
| `male-guard` | Ranger body, arms and legs, Ranger boots cut to shoes | crimson | guard, vendor, resident | security, precinct, station, port, night | 1.15 |
| `female-office` | Peasant body and legs, Ranger arms, Peasant shoes | violet | clerk, receptionist, resident | office, downtown, business, finance, tower | 1.19 |
| `female-service` | Peasant body, Ranger arms and legs, Peasant shoes | magenta | bartender, cook, patron | bar, cafe, restaurant, hotel, nightlife | 1.18 |
| `female-casual` | Peasant body and legs, Ranger arms, Peasant shoes | teal | patron, resident, wanderer | city, neighbourhood, residential, suburb, quiet | 1.19 |
| `female-works` | Ranger body, arms and legs, Ranger boots cut to shoes | amber | worker, mechanic, resident | industrial, docks, works, depot, yard, construction | 1.13 |
| `female-courier` | Ranger body and arms, Peasant legs and shoes | cyan | courier, wanderer, patron | downtown, traffic, delivery, market, rush | 1.19 |
| `female-guard` | Ranger body, arms and legs, Ranger boots cut to shoes | crimson | guard, vendor, resident | security, precinct, station, port, night | 1.13 |

### The hair

The hair is cut for a smaller head than this body's. Worn as it comes, two fifths of a buzz cut lies up to 12 mm under the scalp and only a patch of it shows, which reads as a bald head with something on it; the build holds every hairstyle, beard and added pair of brows 3 mm outside the bare skin (`tools/wardrobe/settle.mjs`, the same pass that opens a collar over the neck), and `tests/looks.test.ts` reads the rest-pose geometry back against the skin's normals so no piece is more than 2 percent under it.

## What the library holds

Forty-seven clips, all on the canonical skeleton, all CC0. `tools/build-anims.mjs` reads `clipsUsed()` out of `src/clips.ts` and ships that list and nothing else, so a clip nobody names is not in the file.

| Clip | What it is | Where it comes from |
|---|---|---|
| `Idle_Relaxed_Loop` | on their feet, weight on both, arms hanging with the hands loose by the thighs | posed here, from `Idle_Loop` |
| `Idle_Scratch_Loop` | on their feet, one hand scratching the back of the head | blended and posed here: `Idle_TalkingPhone_Loop`'s raised arm on the relaxed stance, moved to the crown |
| `Idle_Pockets_Loop` | on their feet, both hands in the trouser pockets | posed here, from `Idle_Relaxed_Loop` |
| `Idle_Hip_Loop` | on their feet, weight on the right hip, the left knee soft | posed here, from `Idle_Relaxed_Loop` |
| `Idle_Folded_Loop` | on their feet, weight on both, arms folded | posed here, from `Idle_FoldArms_Loop` |
| `Idle_Phone_Loop` | on their feet, the phone in the palm against the ear | posed here, from `Idle_TalkingPhone_Loop` |
| `Idle_Drink_Loop` | on their feet, raising a glass to the lips and putting it down again in front of the chest | blended and posed here: `Idle_Relaxed_Loop` under `Consume`'s left arm, the arm brought in from arm's length and the glass levelled |
| `Idle_Talking_Loop` | talking with the hands | Quaternius UAL1 |
| `Idle_No_Loop` | standing, shaking the head | Quaternius UAL2 |
| `Idle_Yes_Loop` | standing, nodding | blended here: `Idle_Loop` under the nod out of `Yes` |
| `Idle_Torch_Loop` | on their feet, a hand light held up in the left fist | Quaternius UAL1 |
| `Idle_Rail_Loop` | on the feet, hands on a surface at 1.02 to 1.04 m | Quaternius UAL2 |
| `Idle_Rail_Call` | the same, one arm up calling an order across it | Quaternius UAL2 |
| `Idle_Bench_Loop` | hands on the top, chin down over the work | posed here, from `Idle_Rail_Loop` |
| `Idle_Browse_Loop` | standing, chin down on what is in front of them | posed here, from `Idle_Relaxed_Loop` |
| `Farm_Watering` | standing, head down, one hand working over something in front at about 1.05 m | Quaternius UAL2 |
| `Farm_Harvest` | standing, bending to pick something 0.31 m ahead at 0.28 m and straightening up | Quaternius UAL2 |
| `Crouch_Idle_Loop` | squatting, hips 0.28 m behind the root, head 0.21 m ahead of it at 0.84 m | Quaternius UAL1 |
| `Kneel_Fix_Loop` | kneeling, both hands working at something at knee height in front | trimmed and posed here, from `Fixing_Kneeling` |
| `Idle_Wall_Loop` | propped on a wall, arms folded | posed here, from `Idle_FoldArms_Loop` |
| `Idle_WallCross_Loop` | propped on a wall, one ankle hooked behind the other | posed here, from `Idle_Loop` |
| `Idle_WallSmoke_Loop` | propped on a wall, a cigarette at the mouth | posed here, from `Idle_Loop` |
| `Idle_WallPhone_Loop` | propped on a wall, phone at the ear | posed here, from `Idle_Phone_Loop` |
| `Dance_Loop` | dancing | Quaternius UAL1 |
| `Dance_Slow_Loop` | the same dance at two thirds of the speed | trimmed here, from `Dance_Loop` |
| `Sitting_Idle_Loop` | sat, hands in the lap | Quaternius UAL1 |
| `Sitting_Talking_Loop` | sat, talking | Quaternius UAL1 |
| `Sitting_Eat_Loop` | sat at a table, chin down, one hand resting on the top and the other bringing a roll to the mouth | blended and posed here: `Sitting_Idle_Loop` under `Consume`'s left arm, the right arm put on the table and the left brought in to the mouth |
| `Sitting_Drink_Loop` | sat, raising a glass to the lips and putting it down over the lap | blended and posed here: `Sitting_Idle_Loop` under `Consume`, the arm brought in from arm's length and the glass levelled |
| `Sitting_Phone_Loop` | sat, phone at the ear | blended and posed here: `Sitting_Idle_Loop` under `Idle_Phone_Loop`, the arm brought to the ear |
| `Sitting_Desk_Loop` | sat, leaning in, both hands out on the desk | posed here, from `Sitting_Idle_Loop` |
| `Sitting_Stool_Loop` | on a stool, knees up, feet on the rail under the seat | posed here, from `Sitting_Idle_Loop` |
| `Sitting_StoolDrink_Loop` | on a stool, raising a glass | posed here, from `Sitting_Drink_Loop` |
| `Sitting_StoolTalk_Loop` | on a stool, talking | posed here, from `Sitting_Talking_Loop` |
| `Sitting_StoolPhone_Loop` | on a stool, phone at the ear | posed here, from `Sitting_Phone_Loop` |
| `Sitting_Enter` | standing to sat, the root staying put | Quaternius UAL1 |
| `Sitting_Exit` | sat to standing, the root staying put | Quaternius UAL1 |
| `Sleep_Loop` | on their back on the mattress, breathing | blended here: `LayToIdle` held on its first frame, `Idle_Loop`'s breathing over it |
| `Walk_Loop` | walking | Quaternius UAL1 |
| `Walk_Formal_Loop` | walking, arms held closer | Quaternius UAL1 |
| `Walk_Carry_Loop` | walking with something in both hands | Quaternius UAL2 |
| `Jog_Fwd_Loop` | running | Quaternius UAL1 |
| `Sprint_Loop` | running flat out | Quaternius UAL1 |
| `Push_Loop` | pushing a trolley, both hands on its handle | Quaternius UAL1 |
| `Driving_Loop` | sat at a wheel | Quaternius UAL1 |
| `PickUp_Table` | taking something off a surface | Quaternius UAL1 |
| `Interact` | handing something over | Quaternius UAL1 |

The two Quaternius Universal Animation Libraries are 84 clips between them (43 each, `A_TPose` counted once) and the only CC0 source on this skeleton. Twenty-two of them ship as they are, seven more are only the raw material of the twenty-five made here, and the other fifty-five stay out:

| Left out | Why |
|---|---|
| `Idle_Loop`, `Idle_FoldArms_Loop`, `Idle_TalkingPhone_Loop` | a ready stance: feet 0.53 m apart with the left 0.39 m ahead, both knees bent 14 to 27 degrees, and on `Idle_Loop` the elbows bent 30 to 45 with the hands 0.3 m off the hips, one forward and one back. Every standing clip here is built on them with the feet brought level, the knees straightened and, on the idle, the arms hung |
| `Fixing_Kneeling`, `LayToIdle`, `Yes`, `Consume` | one-shots or the wrong body: the kneeling seconds, the lying frame, the nod and the hand-to-mouth are cut out of them into the clips above |
| `Pistol_*`, `Punch_*`, `Sword_*`, `Spell_*`, `Shield_*`, `Melee_*`, `Hit_*`, `Death01`, `Zombie_*`, `NinjaJump_*`, `OverhandThrow`, `TreeChopping_Loop` | weapons, blows, throws and dying: this is a quest game with no combat |
| `Jump_*`, `Swim_*`, `Roll`, `Slide_*`, `ClimbUp_1m`, `Crouch_Fwd_Loop` | nobody in this city jumps, swims, rolls, slides, climbs or sneaks: no stance asks for them |
| `Chest_Open` | a one-shot of bending to lift a lid; the shelves here have no lids |
| `Farm_PlantSeed` | kneels and reaches half a metre ahead at 0.4 m, the same job `Kneel_Fix_Loop` does |
| `Idle_Lantern_Loop` | holds a lantern by its ring at shoulder height; the city is lit by neon and nothing draws a lantern |
| `Idle_Shield_Loop`, `Idle_Shield_Break` | combat idles |
| `A_TPose` | the rest pose, not a clip |

The twenty-five made here come out of clips those packs do have, in three ways (`tools/anims/clips/`, built in the order written, so a clip may build on any clip above it):

- **A pose** holds some bones at an angle for the whole of a clip (`tools/anims/derive.mjs`). The source clip's own breathing and weight shift come through untouched, so a posed body is still moving. The relaxed idles are the ready stance with the feet brought level under the hips and the knees straightened, the arms hung by the thighs; a wall lean is a standing idle tipped 8 degrees back off both ankles; the stool is the chair clip lifted by the difference in pads with the shins swung back under the seat. A pose may also carry `upright`, the one offset that changes frame by frame: a bone is turned, at every keyframe, by the least that keeps one of its own axes within some degrees of vertical, which is what keeps a glass from lying on its side in the lap while the arm the source authored still swings.
- **A blend** lays one clip's movement over another clip's stance (`tools/anims/blend.mjs`), which is the sum the gesture layer does at runtime, done once at build time: `result = stance * (reference^-1 * movement)`. Measured from the movement's own first frame it adds the movement alone, so a seated body drinks; measured from a plain standing idle it also carries the pose, so a seated body gets a phone to its ear. `hold` freezes the stance at one moment, which is how a clip that only passes through lying on the floor becomes a clip that stays there. A blend can be confined to one arm, which is how a meal keeps the other hand on the table. Without `hold` the stance loops a whole number of times under the movement, so the body under a drinking arm goes on breathing.
- **A trim** cuts a section out of a one-shot and eases its last third of a second back to its first frame, so it runs as a loop (`tools/anims/trim.mjs`): the three seconds `Fixing_Kneeling` spends kneeling, and the dance at two thirds of the speed.

Neither can invent a limb the source never moves: there is no free clip of hands working a stove, a keyboard or a counter service, so those stances are held poses with the source's own breathing rather than real work.

### Which stance draws from which

| Anchor kind | Clips |
|---|---|
| `stand` | `Idle_Relaxed_Loop`, `Idle_Scratch_Loop`, `Idle_Pockets_Loop`, `Idle_Hip_Loop`, `Idle_Folded_Loop`, `Idle_Phone_Loop`, `Idle_Drink_Loop` |
| `sit` | `Sitting_Idle_Loop`, `Sitting_Talking_Loop`, `Sitting_Eat_Loop`, `Sitting_Drink_Loop`, `Sitting_Phone_Loop` |
| `sit-drink` | `Sitting_StoolDrink_Loop`, `Sitting_Stool_Loop`, `Sitting_StoolTalk_Loop`, `Sitting_StoolPhone_Loop` |
| `serve` | `Idle_Rail_Loop`, `Idle_Rail_Call` |
| `cook` | `Idle_Bench_Loop`, `Farm_Watering` |
| `work-desk` | `Sitting_Desk_Loop`, `Sitting_Phone_Loop`, `Sitting_Idle_Loop` |
| `work-bench` | `Idle_Rail_Loop`, `Idle_Bench_Loop`, `Kneel_Fix_Loop` |
| `sleep` | `Sleep_Loop` |
| `browse` | `Idle_Browse_Loop`, `Idle_Relaxed_Loop`, `Idle_Folded_Loop`, `Crouch_Idle_Loop`, `Farm_Harvest` |
| `lean` | `Idle_Wall_Loop`, `Idle_WallCross_Loop`, `Idle_WallSmoke_Loop`, `Idle_WallPhone_Loop`, `Crouch_Idle_Loop` |
| `guard` | `Idle_Folded_Loop`, `Idle_Relaxed_Loop`, `Idle_Torch_Loop`, `Idle_Phone_Loop` |
| `dance` | `Dance_Loop`, `Dance_Slow_Loop` |

A shelf's first clip is the plainest reading of that stance, because it is what `Cast.doingAt(kind)` answers with nobody in mind. On every standing shelf, and for `CLIPS.idle`, that is a body at ease: feet level within 8 cm, knees straighter than 160 degrees, and on the idle the elbows straighter than 150 with the hands within 0.25 m of the hips (`tests/pose.test.ts`).

`sit` is a chair: soles on the floor, hips at `seatHeight`. `sit-drink` is a stool: hips at `stoolHeight`, feet on a rail. A `sit-drink` anchor on a chair leaves the body 0.30 m in the air.

`lean` is propped on a wall: back to it, hands free, feet out in front, or squatting against it. It is not the rail stance, which is `serve`, `work-bench` and `cook`.

### Moving along

`GAITS` is every clip that carries a body forward, with the ground speed it was authored for: how fast the planted foot slides back under the body, measured on the clip's keyframes. `Walk_Loop` and `Walk_Formal_Loop` 0.98 m/s, `Walk_Carry_Loop` 0.65, `Push_Loop` 0.30, `Jog_Fwd_Loop` 5.9, `Sprint_Loop` 8.9 (the packs' runs are authored fast, with a short contact and a long flight). `member.pace(v)` scales the playing gait to `v` over its authored speed, held between 0.7 and 1.65: slower drops a body into slow motion, faster into a flicker, so past either end the feet skate by the remainder.

The ceiling is where the street's briskest walker lands. Pedestrians move between 1.19 and 1.61 m/s (the player's 1.4 walk with 15 percent of spread), and the walk clips are 1.5 steps a second with a 0.65 m step at 0.98 m/s, so 1.61 is 1.64 times the clip: 2.5 steps a second, a hurried short step at the top of a brisk walk, the feet still planted (measured on the ball bones' contact velocity against the root). Retuning the walks' speed number would only move the skating, because the number is the clip's real ground speed. `tests/contract.test.ts` paces a walk at 1.61 and reads the clip running at that ratio.

`WALKS` is the two walks a pedestrian may be given and `walkFor(npcId)` draws one off the id, so a street is not in step. `CLIPS.walk` is still a walk for a caller with nobody in mind.

### What may be layered over a stance

`GESTURES` is `Idle_Talking_Loop`, `Sitting_Talking_Loop`, `Idle_Yes_Loop` and `Idle_No_Loop`: the same conversation on two bodies, plus a nod and a shake of the head that go over any of them. A gesture is added to the pose the base clip holds, so only a clip that stays near its own starting pose can be one. A drink, a wave, and the pack's own `Yes` (which throws a hand up with the nod) are whole-arm movements: laid over a stance whose hands are already up they put a forearm through the head, which is why the nod is rebuilt here from the head and chest of `Yes` alone.

A gesture never takes an arm off what it is doing. A clip with a hand busy (holding something, pushing something, or on the head) has that whole arm left out of any gesture over it, so a phone is not waved about while its owner talks. `tests/pose.test.ts` measures every clip against every gesture, so a gesture that cannot be layered is caught rather than seen.

### Things in hands

A clip posed around an object gets the object, built here from a few boxes and cylinders and parented to a bone of the person's own skeleton for exactly as long as that clip plays (`src/props/`, `HANDHELD`). One template per thing is built and cloned, so a bar of drinkers costs one glass.

| Thing | Clips | Where it sits |
|---|---|---|
| phone, 75 x 155 x 10 mm, screen lit | `Idle_Phone_Loop`, `Idle_WallPhone_Loop`, `Sitting_Phone_Loop`, `Sitting_StoolPhone_Loop` | in the right palm, lying along the fingers, screen toward the ear; its middle 0.4 to 6 cm off the head's skin and within 8 cm of ear height through the whole loop, on both bodies |
| cigarette, 85 x 8 mm, tip lit | `Idle_WallSmoke_Loop` | between the second knuckles of the right index and middle fingers, running to the lips, the lit end out |
| glass, a 100 mm tumbler with drink in it | `Idle_Drink_Loop`, `Sitting_Drink_Loop`, `Sitting_StoolDrink_Loop` | in the left grip, axis across the knuckles; its rim reaches the lips each loop and it comes down again to the chest or the lap, tipping no more than 30 degrees on the way |
| filled roll in a paper wrap, 100 x 56 mm | `Sitting_Eat_Loop` | in the left grip like the glass, the open end toward the index finger; brought to the mouth each loop and rested over the lap |
| hand light, a lit tube on a grip | `Idle_Torch_Loop` | in the left fist, standing up within 30 degrees of vertical |
| trolley, a cage on four wheels | `Push_Loop` | in front of the body, its handle through both hands within 6 cm all the way round the cycle |

The hand bone's frame, which every grip is written against: +Y runs down the fingers from the wrist, Z runs across the knuckles with the index finger at +Z, and the palm faces -X on the right hand and +X on the left. `tests/props.test.ts` checks the frame and every placement.

### Eating and drinking

`Consume` is the pack's one hand-to-mouth movement, and it is authored at arm's length: it lifts the hand to head height half a metre in front of the face, which over a seated stance is somebody holding a glass out at a mirror. So each of these clips is built in three steps (`tools/anims/clips/`), the arm brought in over two poses and the thing in the hand levelled frame by frame, and what reaches the mouth is measured rather than eyeballed. Measured on both bodies over a whole loop (`tests/props.test.ts`), with the thing's open end against the nearest point of the head's skin:

| Clip | To the lips | The thing travels | Tipped at most |
|---|---|---|---|
| `Idle_Drink_Loop` | 1 mm | 0.88 to 1.54 m | 30 degrees |
| `Sitting_Drink_Loop` | 3 mm | 0.60 to 1.12 m | 30 degrees |
| `Sitting_StoolDrink_Loop` | 2 to 3 mm | 0.90 to 1.42 m | 30 degrees |
| `Sitting_Eat_Loop` | 6 to 16 mm | 0.67 to 1.08 m | a roll, so it is not levelled |

Nothing ever enters the head, and the body keeps breathing underneath: the stance loops a whole number of times under the arm rather than being frozen at one frame, so a diner's head moves 7 mm and the hand resting on the table 9 while the other hand eats.

The meal is on the `sit` shelf, which is a chair at a table: the resting wrist rides 0.80 to 0.81 m, next to the desk clip's 0.78 over the same 0.75 top. The stool shelf (`sit-drink`) is a bar and carries the drink alone; lifted onto the stool that wrist would ride 1.11 m, a hand over a 1.0 m bar counter, so eating at a bar wants an arm posed for the counter rather than the table.

### Being spoken to

`member.attend(point)` leaves the stance and gives the point the whole body's attention; `member.resume()` goes back. The position and the object's heading never change hands: the art turns inside the object the game moves, so what the app placed stays placed.

- A standing stance (at a bench, propped on a wall, browsing, anything on its feet) comes up to `Idle_Relaxed_Loop` and the body turns to face the point, easing over 0.3 s. The wall lean's root is 0.44 m off the wall and the rail stance's root is the counter's face, so standing up straight on the root is clear of both.
- A seated stance stays seated: it fades to the seated idle at its own height (`Sitting_Idle_Loop` in a chair, `Sitting_Stool_Loop` on a stool), so hands come off the desk and the glass goes down, and the head and chest turn to the point (up to about 94 degrees of yaw). A point more than 100 degrees off the way the body faces is past what the head can reach, so the body plays `Sitting_Exit` (1.03 s, the root staying put), comes up to the relaxed idle facing the point, and on `resume` plays `Sitting_Enter` (1.30 s) back into the stance.
- A lying stance stays lying.
- `play` from outside ends the attention: the app's order wins.

`tests/attend.test.ts` measures the face turning to the point, the object not moving, the hips staying at chair and at stool height, and the stand-up and sit-down round trip.

### Talking

`member.speak(true)` opens a line, `member.pulse()` is one chunk of it arriving, `member.speak(false)` closes it. It is mimicry, not lip sync: the rig ends at `Head` with no jaw joint and no mesh in the pack carries a morph target, so there is no mouth to shape, and a mouth that moved to a syllable it could not form would read worse than one that does not.

What it does instead, over whatever the body is already doing:

- **The hands.** The talk gesture for the stance they hold, standing or seated, laid over the upper body as any gesture is: `Idle_Talking_Loop` on their feet, `Sitting_Talking_Loop` sat, and nothing at all lying down. It eases up over about 0.15 s to a third of its weight while the line is being waited for, rises toward full weight as the chunks arrive, and eases off when the line closes, so somebody leaning on their counter is still leaning on it.
- **The head.** A beat of 3.5 degrees of nod at 3.1 Hz and 2.5 of sway at 1.7, the neck carrying a third of what the head does, added to the pose the clip and the head-look left. Its phase is drawn off the person's id, so a room of talkers is not in step.
- **The timing.** Each `pulse` adds to the beat's energy, which tops out at one and decays with a third of a second's half life. A stream that stalls goes still within a second and the hands keep going, because the line is still open; a stream that ends goes still and lets go of the hands.

The talk layer follows the clip under it: stand somebody up mid-sentence and they talk with the standing hands, and an arm the new clip has busy (a phone at the ear, a trolley's handle) is left out of it and left to the clip. `gesture(CLIPS.talk)` while they are speaking does nothing, because the talk is already on their hands; a nod or a shake of the head goes over the top of it as it always does. `tests/speech.test.ts` measures each of these against a twin standing still.

### Standing a body against a wall

A lean clip holds the body behind its own root, so a lean anchor is not at the wall. **The anchor goes 0.44 m out from the face of the wall, facing away from it.** That is the deepest point any of the twelve dressed characters reaches behind the root over the whole of any of the five clips with under 5 cm to spare. The feet land about 0.48 m out. `game/cast/tests/pose.test.ts` measures it, so the number cannot drift without the suite saying so; `@gb/forge` carries its own copy, because it cannot import this box.

### Laying a body in a bed

A sleeping body lies along the way it faces and is **centred on its own root: 0.96 m of body either side of it**, crown one way and soles the other, so a sleep anchor goes at the middle of the mattress rather than at one end. The clip carries the height as well: it was authored lying on the floor and is lifted here so the lowest point of the widest coat rests on `METRICS.furniture.mattressHeight`, the same way the sitting clip puts a body's hips at seat height. Both numbers are measured on all twelve dressed characters in `tests/pose.test.ts`.

The bed `@gb/forge` places is 1.84 m of pad and a body with boots on is 1.90 m end to end, so it overhangs by about 3 cm at each end.

### Sitting on a stool

`Sitting_Stool_Loop` and the three clips posed from it put the hips on a pad at `stoolHeight` (0.75) with the same 2.7 cm of give the chair clip has into `seatHeight`, and the same root-to-hips offset (0.33 m behind the root), so a stool anchor is placed exactly like a chair anchor. The shins go back under the seat, knees at 56 degrees, and the soles rest **0.37 m under the pad**: a rail 0.38 m off the floor, measured on all twelve dressed characters.

### Reaching a work surface

| Stance | Where the hands are | What it is drawn against |
|---|---|---|
| `serve`, `work-bench`, `cook` | wrists 1.02 to 1.04 m up, palms 0.97, and 0.02 to 0.13 m in front of the root | `serviceCounterHeight` and `worktopHeight`, both 1.0 |
| `work-desk` | wrists 0.78 m up, 0.20 to 0.24 m in front of the root | `tableHeight`, 0.75 |
| `Kneel_Fix_Loop` | both hands at the root, 0.32 to 0.44 m up: the counter's foot | the front face of the bench, which is where the rail stance's root already is; the body kneels from 0.5 to 1.0 m behind it |
| `Farm_Harvest` on `browse` | the right hand dips to 0.28 m, 0.31 m ahead of the root | the bottom shelf |
| `Crouch_Idle_Loop` on `browse` and `lean` | head 0.21 m ahead of the root at 0.84 m; hips 0.28 m behind it | a low shelf, or the wall a lean anchor is 0.44 m from |

`barCounterHeight` 1.0 carries no stance: it is the rail a customer stands at, and staff work the 1.0 shelf behind it.

## Invariants

- **One stance, several clips.** An anchor kind names a stance; the person's own id picks which of that stance's clips they do. Five people propped on one wall are four different idles, and the same id draws the same one every time the city is opened. A kind with one clip behaves as it always did.
- **Nobody stands in the ready stance.** The packs' own standing idle is not shipped; every standing clip here is at ease on level feet, and the first pick of every standing shelf is measured so.
- **Facing.** A spawned body at `rotation.y = 0` faces -Z, the way a three.js camera looks at heading 0. Set `object.rotation.y` to a heading and the person faces along it. The source art faces the other way in its own files; `spawn` holds it at half a turn inside the object the game moves, so nothing outside this box has to know. `attend` turns the art inside the object; the object is never touched.
- Nobody's foot goes through the floor and nobody floats: through every standing stance and every outfit the lowest point of a posed body stays within two centimetres of the ground the root stands on. `Sleep_Loop` and the stool clips are the ones that carry their own height, resting on the mattress and the pad rather than on the floor. The gaits are the packs' own and a heel strike in `Walk_Loop` dips 3 cm.
- One clip library and one character mesh per outfit for the whole game; a person is a clone sharing that geometry with their own skeleton and their own mixer, and a thing in their hand is a clone sharing one template.
- Everybody is dressed. Every body kind has outfits cut for it, and a wardrobe with nothing cut for a body dresses off the whole of it rather than sending somebody out bare.
- Nobody stands in the rest pose. `spawn` falls back to the idle when it is handed a clip the library has not got, and `load` refuses a library with no clips in it, so a typo is a wrong animation rather than a T-posing NPC.
- No limb ends up inside the head, through any clip the game plays or any gesture layered over it.
- Every material a character renders with carries its base colour texture, so nobody comes out the white of a missing map.
- **Nothing worn crosses the skin it is worn over.** Every garment, hairstyle, beard and pair of brows is held outside the bare head and neck in the build, and through the stance a person spawns in, on both builds, no cloth reaches more than 6 mm back inside it. A garment that crosses the skin reads as a hole with torn edges, because the skin covers the cloth in one triangle and the cloth covers the skin in the next.
- **Cloth is cloth.** Every garment renders between 0.40 and 0.86 roughness at metalness 0, off a weave sheet built for that outfit, so a near-black coat catches a broken sheen that moves rather than one hard highlight.
- **A garment gives off light only where it asked to.** The lit accent is one fabric of one outfit; the sheet a family emits from carries that garment's own accent and nothing an earlier garment left on the pixels they share, so a boot painted with no accent does not glow.
- Everybody has hair, or is bald on purpose: the hairstyle, the eyebrows, the beard and the colour of all three are drawn from the NPC's id, and the eyebrows always match the hair. Every piece sits outside the skin, so a buzz cut shows as a buzz cut. Tinted materials are shared across the whole cast, so a crowd costs one material per colour per hair texture, not one per person.
- The same NPC id gets the same outfit, the same hair, the same build, the same walk and the same point in the loop every time the city is opened, so a shared world file looks the same to everyone.
- A build is the rig scaled, never a second body: it reaches the skin of the bones it names and nothing hanging off them, no clip carries a scale channel that could undo it, and through every clip the heavy body's feet, hips and back land where the regular body's do.
- Nobody's mouth is animated. Speech is the talk gesture and a head beat over whatever they are doing, so a person keeps their stance while they talk and goes still within a second of the words stopping.
- Every name in `CLIPS_FOR_ANCHOR`, `CLIPS`, `GAITS`, `WALKS` and `GESTURES` is in the shipped library, because `clipsUsed()` is all five lists and the build ships exactly that; the tests fail if one goes missing, so a renamed clip is caught at build time.
- A stance is a clip, so the two working anchors are two bodies: `work-desk` sits in the chair with its hands out on the desk top, `work-bench` stands at the bench with its hands on the counter top, or kneels at its foot. Both heights are measured against `METRICS.furniture` in the tests.
- The head-look and gesture layers run after the mixer and never replace the base clip: the chest, neck and head turn off the pose the clip left, and a gesture adds to it on the upper body only, sparing an arm the clip has busy.
- The look stays inside about 94 degrees of yaw and 52 of pitch off the clip's own pose, and eases in and out over about a fifth of a second.

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

`finish` is what every garment renders as cloth with, and it is one block for the whole wardrobe:

- `roughness` (0.86) is the roughest any of them gets, and the factor the material ships; `metalness` (0) is what cloth is, because a dielectric is the difference between a coat and a wet coat.
- `threads` (210 across the sheet) and `depth` (0.2) are the weave the roughness map is dipped by (`tools/wardrobe/weave.mjs`), generated from the pixel's own coordinates. Each fabric of the source sheet also carries its own level (`tools/wardrobe/fabrics.mjs`): cloth and linen at the ceiling, straps and leather at 0.82 of it, the hardware at 0.62. Together they put every garment between **0.40 and 0.86 roughness at metalness 0**, so a black coat answers the street unevenly and the highlight moves with the body instead of standing on it.
- `accent` (0.55) is how hard the one lit fabric emits. A fabric marked to glow also keeps its own light and shade rather than settling flat, so the accent reads as a stud on a coat rather than as an even patch of colour.

`roles` are `@gb/world` `NPC_ROLES`; `themes` are words looked for in the world's theme text. An outfit made for the NPC's role scores 2, a theme word scores 1, and the best score wins; ties are broken by the NPC's id. Give an outfit no roles and no themes and it becomes a fallback that only gets worn when nothing else fits the body.

Then run `node tools/build-wardrobe.mjs`, then `node tools/check-rig.mjs <a body gltf> assets/dist/characters/*.glb`.

The build refuses an outfit whose joints are not the canonical skeleton in the canonical order, one whose clothes stop below the bare neck the body keeps, and one that leaves a fabric of its source sheet unpainted.

## Adding a hairstyle

Hair is listed per body in the `hair` block of `game/cast/wardrobe.json`: `styles` are the pieces to offer, `brows` is the second pair of eyebrows, `beard` is the one beard. Each file is a glTF skinned to the canonical skeleton (the pack's "Rigged to Head Bone" export), and the build refits it to this body's head the same way it refits clothes, then holds it 3 mm outside the skin. Colours live in `src/look.ts` with a weight each, so the mix of grown and dyed is one edit; they multiply a greyscale strand map, so they read brighter than the hair they make.

## How to modify this blackbox safely

New clips go in `CLIPS`, `CLIPS_FOR_ANCHOR`, `GAITS`, `WALKS` or `GESTURES` and then in the pack: `node tools/build-anims.mjs` builds from `clipsUsed()`, so naming a clip there is what ships it, and a name no source pack has fails the build. A clip no pack has is written in `tools/anims/clips/` (standing, working, seated) as a pose (per-bone angles on a clip already in the library; `tools/anims/derive.mjs` says what the angles mean), a blend (one clip's movement laid over another's stance; `tools/anims/blend.mjs`) or a trim (a section of a one-shot closed into a loop; `tools/anims/trim.mjs`). The list is built in the order written, so any clip may build on any clip above it, and a step on the way that nothing names is not shipped. Every clip drives all 65 bones, and it has to: the character files' own rest poses sit a few millimetres off the animation mannequin's, so a clip that leaves a bone undriven leaves it wherever that file put it, which is 5 cm at a toe. A clip only belongs in `GESTURES` if it stays near its own starting pose. A clip posed around a thing gets a row in `HANDHELD` and, if it is a new thing, a builder in `src/props/`. A new body needs a `BODY_KIND` in `@gb/world` first, then a body file in `game/cast/wardrobe.json` and at least one outfit cut for it. A new build is a set of ratios and which roles draw it in `src/build.ts` and `src/physique.ts`, and it stays a scaling of the one rig, so it costs no file and no download. Rebuild the pack, run the gate, then `pnpm --filter @gb/cast test`.
