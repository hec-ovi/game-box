# game-box

> **Under construction.** The loop works end to end: a city generates, you walk it, go into the places that open, talk to the people there and finish the jobs they hand out. Plenty is unfinished and everything here can still change.

A first-person open-world city game that runs in a browser. TypeScript and three.js, WebGPU where the machine has it and WebGL2 where it does not, in a pnpm workspace on Node 22.

You give it a theme and a seed. It writes the town's history, lays out streets and buildings from that history, furnishes the handful of places that open, invents the people standing in them and writes the errands they hand out. What comes back is one JSON file. Send it to somebody and they walk the same city, meet the same people and get the same jobs.

The loop is quests, not combat: talk to somebody, cross town, go into a building, find a person or a thing, take it, carry it, leave it somewhere, deliver it, get paid. Quests branch, and a branch you did not take stays in the journal so the choice reads as one.

## What you need

- **Node 22 or newer, and pnpm.** That is the whole requirement to play.
- **A browser.** No native build, no compile step, no server unless you want the model.
- **A model endpoint, optional.** Anything that speaks the OpenAI chat shape. Without one the city is written by an offline author built into the game, and everything is playable: the same streets, the same interiors, the same quest kinds, named and described from the seed instead of by a model.

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

Four ways to run, and the game is playable in all four.

**Nothing running.** The default. The city is written by the offline author in the browser.

```
http://localhost:5180/?seed=gulch&theme=dusty+western+town
```

**The sidecar, answering from a stand-in.** A small Node service on `127.0.0.1:8976` that speaks the OpenAI chat shape. With no upstream set it answers from a built-in stand-in, which is how the model path gets exercised without a model.

```
pnpm -C host dev        # reads .env at the repo root
```

**The sidecar, in front of a real model.** Point it at any OpenAI-compatible server. A local llama-server is what this is developed against, but nothing is specific to it.

Set `GAME_BOX_LLM_UPSTREAM` in `.env` at the repo root and run the same command. A URL points it at a local server; the word `openrouter` points it at OpenRouter and attaches `OPENROUTER_API_KEY`. A URL is always called unauthenticated, so a key cannot reach a server it does not belong to.

```
GAME_BOX_LLM_UPSTREAM=http://127.0.0.1:8080     # a local model
GAME_BOX_LLM_UPSTREAM=openrouter                # a hosted one
```

`pnpm -C host start` runs it without reading `.env`, for when the variables are already exported.

**The sidecar, in front of a hosted model.** The same sidecar, routed through OpenRouter to `stealth/ox-alpha` instead of a machine of your own. The key is read from the environment, sent only to OpenRouter, and never written to a tracked file: copy `.env.example` to `.env` and fill it in.

```
GAME_BOX_LLM_UPSTREAM=openrouter node --env-file=.env --experimental-strip-types host/src/main.ts
```

A URL is always called without credentials, so a key sitting in your environment is never handed to a server of your own.

Then add `&model` to the URL, or `--model` to `gb build`, and the names, the history, the people and the quests come from the endpoint instead of the offline author.

`GAME_BOX_PORT` moves the sidecar off 8976, and `?sidecar=` in the URL points the game at a different one.

Everything generated comes back as a **tool call whose parameters are the JSON Schema of the contract that will validate it**, so the thing that defines the shape and the thing that checks it are the same object. Nothing a model writes is trusted: a quest is refused unless every path ends, every person and thing it names exists, and every item is in the player's hands before they are asked for it. A malformed answer is dropped and the offline author fills in, so a bad reply costs some flavour rather than the city.

One thing to know before relying on a model for a shared world. A request can now pin its answer with `temperature: 0` and a `seed`, and both reach the endpoint, but repeating is the endpoint's own property: `stealth/ox-alpha` answered the same pinned question three different ways when measured. The offline author is reproducible today; the model path is not yet.

## Layout

One box is one folder with one owner, a `CONTRACT.md`, and tests that prove what the contract promises. To use a box you read its contract; you never read its `src/`. [docs/INDEX.md](docs/INDEX.md) maps every box to the thing you would want to change.

The game, in TypeScript under `game/`:

| | |
|---|---|
| `world` | the city as a grid of cells, its plots, interiors, people and things, its history, and what makes one sound |
| `forge` | generates a city: streets and plots by arithmetic, the history, the places and the quests by a model |
| `scribe` | the model-backed author behind forge: the history, the places, the people, the quests |
| `quest`, `play` | quests as checked flows, and the playthrough they run against |
| `bundle` | the sealed file a city travels in, what art it was built against, and the save that belongs to it |
| `scene` | the city as something you can stand in: batching, interiors, the street surface |
| `prefab` | real buildings from an art pack, pinned per plot so a shared city keeps its buildings |
| `kitbash` | the fallback building kit, and the words on a sign |
| `furnish` | interiors: floors, walls, furniture built from parameters, carried things, screens that play |
| `cast` | the people: outfits, hair, and the clip a stance implies |
| `crowd`, `traffic`, `drive` | walkers on the pavement, cars on the road, and taking one |
| `land` | ground, water, trees, the horizon and the sky |
| `nav`, `talk`, `hud`, `app` | getting about, conversation, the interface, and the running game |
| `cli` | `gb build`, `inspect` and `check` from the terminal |
| `sidecar`, `kit` | the client that talks to the model, and the shared primitives every box uses |

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
