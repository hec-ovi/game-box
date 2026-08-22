# Resolver: what you want to change -> the one folder to open

The repo is two sets of boxes: the game (TypeScript, `game/`) and the offline AI sidecar it talks to (Rust, workspace root). One box is one folder with one owner. To change something, open its folder; to use it, read its `CONTRACT.md`.

## Game

| You want to change | Open |
|---|---|
| The city: grid, plots, interiors, NPCs, items, and what a sound world means | `game/world/` |
| Quests: the flow schema, what makes one playable, how it advances | `game/quest/` |
| The playthrough: inventory, money, flags, reputation, companions | `game/play/` |
| Generating a city: streets, plots, interiors, people, quests | `game/forge/` |
| Exporting and importing a city, and the save file | `game/bundle/` |
| Walking routes, reachability, waypoints | `game/nav/` |
| Talking to the local model: one checked answer, or a streamed reply | `game/sidecar/` |
| Asking the local model to write names, people and quests | `game/scribe/` |
| Conversations with NPCs and what they are allowed to do | `game/talk/` |
| Turning a world into three.js objects, and where art plugs in | `game/scene/` |
| The people: bodies, clothes, clips, who is doing what | `game/cast/` |
| Buildings that look like buildings, from the city kit | `game/kitbash/` |
| Pedestrians walking the streets | `game/crowd/` |
| Cars driving the roads | `game/traffic/` |
| The interface: objectives, prompts, conversation, journal, events | `game/hud/` |
| Determinism, ids, results, boundary validation | `game/kit/` |
| The running game: renderer, frame loop, first-person body, wiring | `game/app/` |
| The `gb` command: build, inspect, check a city | `game/cli/` |

## Sidecar

| You want to change | Open |
|---|---|
| HTTP/WS endpoints, SSE shapes, OpenAI compatibility, tool calls, error bodies | `api/` |
| Text generation, engine selection, llama.cpp/upstream wiring | `llm/` |
| Speech recognition, audio envelopes, partial transcripts | `stt/` |
| Speech synthesis, voices, streaming audio frames | `tts/` |
| Model cache, integrity check, (future) downloads | `models/` |

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
game/world, game/quest, game/play, game/sidecar <- game/talk
game/world <- game/nav, game/scene, game/traffic
game/scene <- game/cast, game/kitbash
game/cast, game/nav <- game/crowd
game/quest <- game/hud
everything  <- game/app
gb-llm, gb-stt <- gb-api
```

`game/quest` reads a world only through its own five-question `WorldView` port, so quests stay independent of how a world is built. `game/hud` renders what it is given and never reaches into the game.

## Rules of engagement

Outsiders read a box's `CONTRACT.md` and `schema/` only, never its `src/`. Cross-box data is schema-validated at the boundary and fails closed. Every box change updates its contract and schemas in the same commit.

Game boxes are enforced, not just documented: each package exposes one entry (`exports: { "." : ... }`), `pnpm run check:isolation` fails on a deep import or an undeclared dependency, and `pnpm run verify` runs generation, typecheck, the isolation check and every test in one pass. Rust boxes verify with `cargo test`.

Art has one more gate: `node tools/check-rig.mjs` fails if any skinned file drifts off the canonical 65-joint skeleton, because a clip written for one skeleton tears another apart.
