# game-box

> **Under construction.** The loop works end to end: a city generates, you walk it, go into the places that open, talk to the people there and finish the jobs they hand out. Plenty is unfinished and everything here can still change.

A first-person open-world city game that runs in a browser. TypeScript and three.js, WebGPU where the machine has it and WebGL2 where it does not, in a pnpm workspace on Node 22.

You give it a theme and a seed. It writes the town's history, lays out streets and buildings from that history, furnishes the handful of places that open, invents the people standing in them and writes the errands they hand out. What comes back is one JSON file. Send it to somebody and they walk the same city, meet the same people and get the same jobs.

The loop is quests, not combat: talk to somebody, cross town, go into a building, find a person or a thing, take it, carry it, leave it somewhere, deliver it, get paid. Quests branch, and a branch you did not take stays in the journal so the choice reads as one.

## Turn WebGPU on first

The game runs on WebGPU where the machine has it and falls back to WebGL2 where
it does not. The fallback works, but it is not what the city is built to look
like: walls lose their material, daylight goes flat, and frame times stop
meaning anything.

On Linux, Chromium browsers (Chrome, Brave, Edge) still keep WebGPU behind a
flag for most driver setups, so check before you judge how it looks.

1. Open `brave://flags` (or `chrome://flags`).
2. Search `webgpu` and set **Unsafe WebGPU Support** to Enabled.
3. Search `vulkan` and set **Vulkan** to Enabled.
4. Restart the browser.
5. Open `brave://gpu` (or `chrome://gpu`) and check WebGPU reads as hardware
   accelerated rather than disabled.

Flags set on that page persist, so this is once per machine, not once per
launch. If the console says `No available adapters` and
`WebGPU is not available, running under WebGL2 backend`, the flags did not take.

## What you need

- **Node 22 or newer, and pnpm.** That is the whole requirement to play.
- **A browser.** No native build, no compile step, no server unless you want the model.
- **A model endpoint.** Anything that speaks the OpenAI chat shape, reached through the sidecar. Every word of a city comes from it: the history, the names, the people and the work. Without one a city cannot be written.

## Playing it

```
pnpm install
pnpm --filter @gb/app run dev        # http://localhost:5180
```

Click to take the mouse, WASD to walk, shift to run, hold the right button to look closer, E to act on whatever is in front of you, Escape to leave a conversation.

A seed and a theme in the address builds that city:

```
http://localhost:5180/?seed=gulch&theme=dusty+western+town
```

The sidecar has to be running, because the model writes the city. See below.

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

The model writes every word of a city. The streets, the plots and the shape of
the town are arithmetic from the seed, and everything a player reads is written:
the history, the name of the city, the name over each door, who is inside, what
they know, and the work they hand out. There is one way to write a city and this
is it.

Three ways to run it.

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

To check which upstream it actually picked up:

```
curl -s -X POST 127.0.0.1:8976/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"hi"}]}' | head -c 200
```

The `model` field in the reply is the answer. `game-box/standin` means no upstream was read, so either nothing is configured or the environment did not reach the process. Any other name is the model that answered.

**The sidecar, in front of a hosted model.** The same sidecar, routed through OpenRouter to `google/gemma-4-31b-it:free` instead of a machine of your own. The key is read from the environment, sent only to OpenRouter, and never written to a tracked file: copy `.env.example` to `.env`, fill it in, and run the same `pnpm -C host dev`. The game's settings can write the key for you instead, into a `.env.local` the repo ignores.

```
GAME_BOX_LLM_UPSTREAM=openrouter
OPENROUTER_API_KEY=sk-or-...
```

A free model is rate-limited often. The sidecar answers that as `429` with a `Retry-After`, and the game waits it out and asks again rather than treating the model as gone.

`gb build` takes `--model` to write a city from the terminal through the same endpoint.

`GAME_BOX_PORT` moves the sidecar off 8976, and `?sidecar=` in the URL points the game at a different one.

Everything generated comes back as a **tool call whose parameters are the JSON Schema of the contract that will validate it**, so the thing that defines the shape and the thing that checks it are the same object. Nothing a model writes is trusted: a quest is refused unless every path ends, every person and thing it names exists, and every item is in the player's hands before they are asked for it. A stage that cannot be written stops the build and says which one it was, rather than substituting something nobody asked for.

One thing to know before relying on a model for a shared world. A request pins its answer with `temperature: 0` and a `seed`, and both reach the endpoint, but repeating is the endpoint's own property rather than a promise this project can make. Measured on 2026-08-27 through OpenRouter on `google/gemma-4-31b-it:free`, one request at a time: the same pinned question came back identical byte for byte, 3 of 3. A local llama-server holds a seed only while nothing else shares the engine, because a batch it is computed in changes the answer. A command-line agent takes neither: `agy` accepts no temperature and no seed, so
a request's pins reach nothing on that path. Measured on 2026-08-27, the same
pinned request named the city Oakhaven-on-Silt, then Brinegate. Run
`host/tools/repeatable.ts` against whichever engine you configured, as you
actually start it.

Line 7 above says a city travels: send the file and somebody walks the same
city. That is the file, not the recipe. The JSON carries the whole town, so it
is identical wherever it is opened. Rebuilding it from the same theme and seed
is only identical when the engine that wrote it repeats itself.

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

## Where your cities are kept

Everything you make in the browser stays in that browser, on that machine. There
is no account and no server: nothing you generate is uploaded anywhere.

Two stores, both per browser and per site:

| What | Where | Key |
|---|---|---|
| The cities on your shelf | IndexedDB | database `game-box`, stores `worlds` and `documents` |
| The playthrough of each city | localStorage | `game-box.save.<key>` |
| Your settings and any saved draft | localStorage | `game-box.settings`, `game-box.draft` |

So a city you built in Chrome is not on your shelf in Firefox, and neither is
its playthrough. The same is true across browser profiles, across machines, and
across a different port on localhost, because the browser keys both stores by
origin.

A private window keeps nothing. Both stores fail closed rather than breaking the
game: the shelf comes up empty and the game still starts, because a game that
will not run because it cannot remember is worse than one that forgets.

To move a city, take the file. Download on the landing screen writes the whole
city out, and `gb build --out city.json` does the same from the terminal. Open
it in the other browser and you get the same streets, the same people and the
same jobs. Your progress through it does not travel with it.

Clearing site data for `localhost:5180` erases every city and every save.

## The art

Models and animations are Quaternius and KayKit. Surfaces are generated: `docs/textures/IMAGES.md` holds every prompt, where each file lands, and what was rejected and why. `assets/registry/sources.json` records every source with the licence its own file states, and `node tools/inspect-glb.mjs` prints that licence beside what a model would cost.

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
