# game-box

> **Under construction.** The city generates, you can walk it, go into buildings, talk to the people in them and run errands for them. Plenty is unfinished and everything here can still change.

A browser game where the city is written for you. Give it a theme and a seed, and a local model lays out a town, furnishes its interiors, invents the people standing in them and writes the errands they hand out. The result is one file you can send to someone else, and they walk the same city with the same people and the same jobs.

The loop is quests, not combat: talk to somebody, cross town, go into a building, find a person or a thing, take it, carry it, deliver it, get paid.

## Playing it

```
pnpm install
pnpm --filter @gb/app run dev        # http://localhost:5180
```

Click to take the mouse, WASD to walk, shift to run, hold the right button to look closer, E to act on whatever is in front of you, Escape to leave a conversation.

By default the city is generated in the browser from the seed in the URL, so nothing else has to be running:

```
http://localhost:5180/?seed=gulch&theme=dusty+western+town
```

Add `&model` to have a local model write the names, the people and the quests instead of the offline author. That needs the sidecar (below).

## Building a city from the terminal

```
pnpm --filter @gb/cli run gb build --theme "rain-soaked port" --seed harbour --out city.json
pnpm --filter @gb/cli run gb inspect city.json     # the grid, its places, its quests
pnpm --filter @gb/cli run gb check city.json       # opens it the way the game does, then walks it
```

`gb check` is the honest test of a shipped city: it opens the bundle exactly as the game would, then proves every building can actually be reached on foot.

## The model

NPC dialogue and the world author both talk to a small sidecar on 127.0.0.1 that speaks the OpenAI shape. It runs a stand-in by default; point it at any OpenAI-compatible server for the real thing:

```
node --experimental-strip-types host/src/main.ts              # stand-in
GAME_BOX_LLM_UPSTREAM=http://127.0.0.1:8080 node --experimental-strip-types host/src/main.ts   # a real model
```

Everything generated comes back as a **tool call whose parameters are the JSON Schema of the contract that will validate it**, so the thing that defines the shape and the thing that checks it are the same object. Nothing a model writes is trusted: a quest is refused unless every path ends, every person and thing it names exists, and every item is in the player's hands before they are asked for it.

## Layout

One box is one folder with one owner, a `CONTRACT.md`, and tests that prove what the contract promises. To use a box you read its contract; you never read its `src/`. [docs/INDEX.md](docs/INDEX.md) maps every box to the thing you would want to change.

The game, in TypeScript under `game/`:

| | |
|---|---|
| `world` | the city as a grid of cells, its plots, interiors, people and things, and what makes one sound |
| `forge` | generates a city: streets and plots by arithmetic, names and quests by a model |
| `quest`, `play` | quests as checked flows, and the playthrough they run against |
| `bundle` | the sealed file a city travels in, and the save that belongs to it |
| `scene`, `cast`, `kitbash`, `land` | turning all that into something you can stand in |
| `crowd`, `traffic` | people on the pavement, cars on the road |
| `nav`, `talk`, `hud`, `app` | getting about, conversation, the interface, and the running game |

The sidecar, in `host/`: `api`, `llm`, `stt`, `tts`, `models`. Node with one dependency and no build step.

## The art

Everything shipped is CC0, from Quaternius and KayKit, because a world file hands assets to whoever opens it: a licence that forbids redistributing the file is unusable here however free it is. `assets/registry/sources.json` records every source and its licence, and `tools/fetch-assets.mjs` refuses anything that is not redistributable.

```
node tools/fetch-assets.mjs      # download the packs
node tools/build-anims.mjs && node tools/build-pack.mjs && node tools/build-wardrobe.mjs
node tools/check-rig.mjs <canonical> assets/dist/characters/*.glb
```

Every skinned file has to carry the same 65-joint skeleton or a clip written for one tears another apart, and `check-rig.mjs` is the gate that enforces it.

## Verifying

```
pnpm run verify     # generate, typecheck, box isolation, every test
pnpm -C host test   # the sidecar
```

Isolation is enforced, not just documented: each box exposes one entry, and the check fails on a deep import into another box or a dependency that is not declared.

## Decisions

[docs/DECISIONS.md](docs/DECISIONS.md) records what was chosen and why, including the things that were rejected and the risks still open.
