# Resolver: what you want to change -> the one folder to open

The repo is two sets of boxes: the game (TypeScript, `game/`) and the offline AI sidecar it talks to (Rust, workspace root).

## Game

| You want to change | Open |
|---|---|
| The city: grid, plots, interiors, NPCs, items, and what a sound world means | `game/world/` |
| Quests: the flow schema, what makes one playable, how it advances | `game/quest/` |
| The playthrough: inventory, money, flags, reputation, companions | `game/play/` |
| Generating a city: streets, plots, interiors, people, quests | `game/forge/` |
| Exporting and importing a city, and the save file | `game/bundle/` |
| Walking routes, reachability, waypoints | `game/nav/` |
| Determinism, ids, results, boundary validation | `game/kit/` |

## Sidecar

| You want to change | Open |
|---|---|
| HTTP/WS endpoints, SSE shapes, OpenAI compatibility, error bodies | `api/` |
| Text generation, engine selection, llama.cpp/upstream wiring | `llm/` |
| Speech recognition, audio envelopes, partial transcripts | `stt/` |
| Speech synthesis, voices, streaming audio frames | `tts/` |
| Model cache, integrity check, (future) downloads | `models/` |

## Elsewhere

| You want to change | Open |
|---|---|
| Stack and architecture decisions with their rationale | `docs/DECISIONS.md` |

## Dependency edges

```
game/kit  <- game/world <- game/forge <- game/bundle
game/kit  <- game/play  <- game/quest <- game/forge
game/world, game/quest, game/play <- game/bundle
game/world <- game/nav
gb-llm, gb-stt <- gb-api
```

`game/quest` reads a world only through its own five-question `WorldView` port, so quests stay independent of how a world is built.

## Rules of engagement

Outsiders read a box's `CONTRACT.md` and `schema/` only, never its `src/`. Cross-box data is schema-validated at the boundary and fails closed. Every box change updates its contract and schemas in the same commit.

Game boxes are enforced, not just documented: each package exposes one entry (`exports: { "." : ... }`), `pnpm run check:isolation` fails on a deep import or an undeclared dependency, and `pnpm run verify` runs schema generation, typecheck, the isolation check and every test in one pass. Rust boxes verify with `cargo test`.
