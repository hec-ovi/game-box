# Every requirement, and whether it is actually done

Built from `docs/REQUIREMENTS.md`, which is the owner's words in order. Nothing
is dropped from this list because it was hard or forgotten.

Three states, and the difference matters:

- **verified** — checked directly, with a number or a screenshot behind it
- **reported** — an agent says it works, not independently confirmed
- **open** — not built, or built and known wrong

## The core loop

| Requirement | State | Evidence or what is missing |
|---|---|---|
| Browser three.js game, first person | verified | Walked it |
| Quests are the point, not shooting | verified | 300 quests driven to completion, 0 rejected |
| Main quest and side quests | verified | Main line gates side work by standing; 3 to 16 offered at start, not all 101 |
| Quests as reusable flows | verified | 8 step shapes, escort, choice, counts, hidden, timers |
| Talk to NPCs | verified | Played in a browser: a job offered, taken, delivered and paid, twice, once with the model and once with the sidecar dead |
| Inventory, carry a thing from A to B | verified | Rewards land in `@gb/play`, items removed on delivery |
| Pre-made animations, never procedural walking | verified | Clip library on a canonical 65-joint skeleton |
| Barista behind a bar, people sitting | verified | Anchors with per-anchor clips |
| NPC companions follow you | verified | 203-cell route, worst gap 3.43 m, 0 teleports |
| Companions ride in the car with you | done | `@gb/drive`: any car on the road can be taken, companions ride in three seats and are back on the pavement when you get out |

## The city

| Requirement | State | Evidence or what is missing |
|---|---|---|
| Randomised, a different city each seed | verified | 12 seeds gave 1 street grid, now 12 |
| Themes actually change the world | verified | 3 themes hashed identical, now 3 distinct worlds |
| Matrix of spaces: houses, buildings, pavements, streets | verified | 2 m cell grid |
| Correct proportions | verified | `METRICS` is the single source |
| Enter a building | verified | Doorstep, interior, back out |
| Bounded by mountains, exit by long roads | verified | Exit corridor is a real road in the graph |
| Water, trees, irregular ground, open horizon | verified | 6 to 7 km landscape, 5 draws |
| Day, night, rain | verified | Clock and weather drive sky, lamps, windows |
| Player can control time and weather | done | `T`, `K`, `P` in the controls tab |
| Import and export a city | verified | Browser export reopens; `contentHash` matches headless |
| Everyone replays the same world | verified | Same seed, byte-identical, model up or down |
| **Add houses and people to empty space later** | **open** | `Forge.extend` exists and is tested. Nothing calls it. |
| Big cities | verified | 20x20, 2,102 buildings, `gb check` 1.1 s |

## Generation

| Requirement | State | Evidence or what is missing |
|---|---|---|
| Architect, interiors, NPCs, quest writer as separate passes | verified | Forge stages plus `@gb/scribe` |
| All LLM driven, with an offline fallback | verified | One agent per place, in parallel: slot occupancy peaked 5 of 5 against a documented 1, and the facade pass went 376 s to 92 s |
| Tool calls, not free text | verified | Forced tool calls end to end |
| Buildings from `glb-buildings` | done | `@gb/prefab`: 217 triangles a building against the kit's 9,300, one batch, zero bytes added to the world file, with photographed rooms behind the glass |

## Interface

| Requirement | State | Evidence or what is missing |
|---|---|---|
| Quest menu | verified | Quests tab, tracked quest, Follow |
| Inventory on `i` | verified | Items tab |
| Windows that close, one at a time | verified | Two modals could overlap; now one window, four tabs |
| Not awful, not 90s HTML | verified | Identity landed, iterated against three real frames |
| A map showing locations | verified | The city, the plots and the player's arrow; indoors the arrow sits on the building's own doorstep |
| A guide to reach a quest | verified | `G` from inside a shop: "Endicott & Daughters: 50 m, head west" against 39 m straight line, correct bearing. A `collect` step resolves place to npc to item and pins one doorstep |
| Journal ticks steps not yet reached | done | Though `@gb/hud`'s `QuestStep` carries only `done`, so open and not-yet-reached still look alike |

## People

| Requirement | State | Evidence or what is missing |
|---|---|---|
| Clothes not medieval | done | Twelve outfits recut from four, near-black coated garments with one lit accent each; the boots were a fused mesh and had to be cut by triangle height |
| Hair and hair colour variety | done | Five cuts, twenty colours, half of them dyed |
| Face turns to you when talked to | done | The body stops, turns, and the head leads it |
| **Lip sync, gestures, drinking** | **open** | Gestures exist in the box; nothing drives them from conversation |

## Look

| Requirement | State | Evidence or what is missing |
|---|---|---|
| Not cartoonish | verified | Sky lighting, shadows, bloom, a cold night grade, neon signage, wet reflective roads, a painted galaxy, and rooms you can see into from the pavement |
| Cyberpunk night, neon, wet streets | verified | Direction in `docs/LOOK.md`, landed across seven boxes |
| Performance must not suffer | verified | 1,069 draws to 46; 18.14 ms to 2.49 ms with shadows |

## Bugs he reported

| | State |
|---|---|
| Interiors totally black | verified fixed |
| CORS on conversations | verified fixed |
| No collision on interior furniture | verified fixed |
| Wall textures scaled far too large | verified fixed |
| Stars painting over everything | reported fixed |
| Moon is a white ball | reported fixed |
| Pavement on top of the street | verified fixed |
| Street lamp standing in the road | reported fixed by the same change |
| A car traps you | verified fixed |
| Stray `e` in the chat box | verified fixed |
| White frame and scrollbars | verified fixed |
| Bartenders resting on air | reported fixed, horizontally; the vertical 6 cm at the bar counter is open |
| Street NPCs cannot be talked to | reported fixed |
| No yellow road markings | verified fixed |
| Boots still read medieval | in flight |
| Red brick and white concrete, too light | in flight |

## Still open

- `@gb/hud`'s `QuestStep` has one boolean where the engine has three states (with hud)
- `HudIntent` has no `abandon`, though `@gb/quest` and `@gb/app` both support it (with hud)
- A conversation opens with a blank panel until the player speaks first (with talk)
- `@gb/scene`'s spawn contract says "the first door in town" and should say "the first door that opens"

## What this list is for

Open, and who has it:

- **Forge, and it is the biggest one.** A room can be cut in half by its own
  furniture. Over 121 interiors in 15 cities: 5 put a prop on the spot 1.2 m
  inside the street door, and 8 of 365 stationed people plus 7 of 242 items sit
  in floor the player cannot walk to. This is what "the shopkeeper is out of
  reach" actually was.
- Lip sync and gestures driven by conversation.
- The city cannot grow while you play: `Forge.extend` is built, tested, and
  called by nobody.
- A timed quest is an invisible real-time stopwatch, and one model reply is 8 to
  19 s of it.
- A TV that plays something, inside the places.
- The premise stage: a history written first, that the city and the quests are
  then built from.
- The creation panel where you describe what the city and the quests are about.
