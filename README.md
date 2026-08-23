# game-box

> **Under construction.** The loop works end to end: a city generates, you walk it, go into the places that open, talk to the people there and finish the jobs they hand out. Plenty is unfinished and everything here can still change.

A browser game where the city is written for you. Give it a theme and a seed, and a local model lays out a town, furnishes its interiors, invents the people standing in them and writes the errands they hand out. The result is one file you can send to someone else, and they walk the same city with the same people and the same jobs.

The loop is quests, not combat: talk to somebody, cross town, go into a building, find a person or a thing, take it, carry it, leave it somewhere, deliver it, get paid. Quests branch, and a branch you did not take stays in the journal so the choice reads as one.

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

## How a city gets written

Four passes, in this order, each one blind to the others' working:

1. **A history.** Why the town is here, what happened recently, what is at stake, and who wants what. Everything after is built out of it: two histories on one seed change 38% of the buildings, and the main quest's fork is two named sides who cannot both win.
2. **The city.** Streets, plots and buildings by arithmetic from the seed. About one building in eight opens; the rest have doors, windows, signs and names, and no way in.
3. **The places that open.** One agent per place, in parallel, each knowing only its own shell: what it is called, who is in it, what they know, what is lying about.
4. **The quests**, written against place names, people and distances, never against geometry.

A city built this way is checked before it ships: every generated quest is driven to completion through the same events a player produces, and a step kind with no way for a player to trigger it is reported as unplayable rather than counted as passing.

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

## Sending a city to someone

`gb build` writes one file. Whoever opens it walks the same city with the same people and the same jobs, and the file records the art it was built against: every plot names the exact building model it was given, so growing the catalogue later leaves an already-shared city untouched. Measured: add one building look and 53 of 123 plots change in an unpinned city, and none in a pinned one.

Opening a city against art you do not have, or a newer version of it, is not refused. The file opens and says which packs disagree.

## The art

Everything shipped is CC0 or generated here, because a world file hands assets to whoever opens it: a licence that forbids redistributing the file is unusable however free it is. Models and animations are Quaternius and KayKit. Surfaces are generated: `docs/textures/IMAGES.md` holds every prompt, where each file lands, and what was rejected and why. `assets/registry/sources.json` records every downloaded source and its licence, and `tools/fetch-assets.mjs` refuses anything that is not redistributable.

A generated tile is measured rather than eyeballed: seam strength on both axes, light spread across the frame, and a repeat sheet checked for any landmark you would notice tiling up a building.

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
