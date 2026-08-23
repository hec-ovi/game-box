# Resolver: what you want to change -> the one folder to open

The repo is two sets of boxes: the game (TypeScript, `game/`) and the offline AI sidecar it talks to (`host/`). One box is one folder with one owner. To change something, open its folder; to use it, read its `CONTRACT.md`.

## Game

| You want to change | Open |
|---|---|
| The city: the history it was built on, its grid, plots, interiors, NPCs, items, the art each plot was designed against, and what a sound world means | `game/world/` |
| Quests: the flow schema, what makes one playable, how it advances | `game/quest/` |
| The playthrough: inventory, money, flags, reputation, companions, things left lying somewhere, where the player is standing, the job they are following, the clock and the weather | `game/play/` |
| Generating a city: the history it is built on, then the streets, plots, interiors, people and quests that follow from it | `game/forge/` |
| Exporting and importing a city, and the save file | `game/bundle/` |
| Walking routes, reachability, waypoints | `game/nav/` |
| Talking to the local model: one checked answer, or a streamed reply | `game/sidecar/` |
| Asking the local model to name the city, write a whole place and the people in it, write the quests, and say how far the build has got | `game/scribe/` |
| Conversations with NPCs: the first thing they say when you walk up, and what they are allowed to do | `game/talk/` |
| Turning a world into three.js objects, the wet street and the rubbish on it, what the things in a room stand on, and where art plugs in | `game/scene/` |
| The people: bodies, clothes, clips, who is doing what | `game/cast/` |
| Buildings that look like buildings, their lit windows, their neon signs, the street lamps drawn from code and the ground they all stand on, from the city kit | `game/kitbash/` |
| Whole buildings out of the committed pack the model authored offline, which one a plot gets and keeps because the world file names it, the rooms you see through their windows, their entrances (lit where you can walk in) and the lit screens on their walls | `game/prefab/` |
| Inside a building: furniture generated from parameters, the things you pick up off it, walls made of bays (panels, lit niches, shelves, grilles, strips, windows), the television and what is playing on it, and floors laid in a pattern and a finish | `game/furnish/` |
| Sky, sun and moon, terrain, water, trees, rain | `game/land/` |
| Pedestrians walking the streets | `game/crowd/` |
| Cars driving the roads | `game/traffic/` |
| The car the player drives: getting in, the handling, who rides with them | `game/drive/` |
| The interface: objectives, prompts, the conversation and the moves you can click in it, announcements, the quests, map, items and controls window, and how it all looks | `game/hud/` |
| Determinism, ids, results, boundary validation | `game/kit/` |
| The running game: the panel you make a city in or open one somebody sent you from, renderer, frame loop, first-person body, the car it drives, the map and the route guide, taking a thing and leaving it where a job wants it, the keys for the hour and the weather, wiring, and how the night is graded | `game/app/` |
| The `gb` command: build a city and pin it to the art it was drawn from, inspect it, check it | `game/cli/` |

## Sidecar

| You want to change | Open |
|---|---|
| HTTP/WS endpoints, SSE shapes, OpenAI compatibility, tool calls, error bodies | `host/src/api/` |
| Text generation, engine selection, llama.cpp/upstream wiring | `host/src/llm/` |
| Speech recognition, audio envelopes, partial transcripts | `host/src/stt/` |
| Speech synthesis, voices, streaming audio frames | `host/src/tts/` |
| Model cache, integrity check, downloads | `host/src/models/` |

## Elsewhere

| You want to change | Open |
|---|---|
| Stack and architecture decisions with their rationale | `docs/DECISIONS.md` |
| Which art we ship and under what licence | `assets/registry/sources.json` |
| Getting the art, building the pack, proving it fits the skeleton | `tools/` |

## Dependency edges

```
game/kit  <- game/world <- game/forge <- game/bundle
game/kit  <- game/play  <- game/quest <- game/forge
game/world, game/quest, game/play <- game/bundle
game/kit <- game/sidecar -> the sidecar's api contract
game/forge, game/quest, game/world, game/sidecar <- game/scribe
game/kit, game/world, game/quest, game/play, game/sidecar <- game/talk
game/world <- game/nav;  game/kit, game/world <- game/scene, game/traffic
game/world <- game/drive   (the traffic, the car art, the crowd and the player all arrive as ports)
game/scene, game/kit <- game/kitbash
game/scene, game/kitbash, game/world, game/kit <- game/prefab
game/scene, game/world, game/kit <- game/furnish
game/scene <- game/cast
game/cast, game/nav <- game/crowd
game/quest <- game/hud
game/forge, game/scribe, game/bundle, game/nav, game/world, game/prefab <- game/cli
everything  <- game/app
```

`game/quest` reads a world only through its own five-question `WorldView` port, so quests stay independent of how a world is built; `@gb/world` publishes `questView(world)` to fill that port. `game/hud` renders what it is given and never reaches into the game.

## Rules of engagement

Outsiders read a box's `CONTRACT.md` and `schema/` only, never its `src/`. Cross-box data is schema-validated at the boundary and fails closed. Every box change updates its contract and schemas in the same commit.

Game boxes are enforced, not just documented: each package exposes one entry (`exports: { "." : ... }`), `pnpm run check:isolation` fails on a deep import or an undeclared dependency, and `pnpm run verify` runs generation, typecheck, the isolation check and every test in one pass. The sidecar verifies with `pnpm -C host test`.

Art has one more gate: `node tools/check-rig.mjs` fails if any skinned file drifts off the canonical 65-joint skeleton, because a clip written for one skeleton tears another apart.
