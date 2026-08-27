# Resolver: what you want to change -> the one folder to open

The repo is two sets of boxes: the game (TypeScript, `game/`) and the offline AI sidecar it talks to (`host/`). One box is one folder with one owner. To change something, open its folder; to use it, read its `CONTRACT.md`.

## Game

| You want to change | Open |
|---|---|
| The city: what it was asked to be, the history it was built on, the charters that say what each kind of place is, the named parts it is cut into, its grid, plots, interiors, NPCs and their lives, items and their prices, the locks on its doors and screens and what opens them, whose home each place is, where fast travel boards, the art each plot was designed against, the sizes furniture is drawn to and plots are cut in, and what a sound world means | `game/world/` |
| Quests: the flow schema, what makes one playable (the people, places, things, doors and machines it names), how it advances from what the game reports, and what finishing pays: credits, things, access, a car, a home | `game/quest/` |
| The playthrough: inventory, money and what it buys, the keys and cards in hand by what they open and the passwords learned, the homes owned and what was put in them, the cars kept and which is out, flags, reputation, companions, things left lying somewhere, where the player is standing, the job they are following, the codex of places and people found, the best score at each game on each machine, what each person remembers of the player and how they feel about them, the clock and the weather | `game/play/` |
| Generating a city: what a brief gives before it is built (its streets, its named parts, its buildings and their heights, with nothing written into them), then the whole thing: the history it is built on and the kinds of place that history declares, then the streets, the named districts its blocks are cut into, plots and stations, how tall each plot builds and where the towers of its skyline stand, interiors with the locks their charters put on them and the screens on their desks, people with their lives and the keys in their pockets, prices on the stock, a home for sale with its deed on a counter, and quests that follow from all of it, played through by a harness in a living town that keeps its locks; then growing a finished one: a door that was painted on opens, new land goes up at the edge, and both get work written over them | `game/forge/` |
| Exporting and importing a city, bringing a file written before charters up to date on the way in, the pack that adds to a finished city and applies to it alone, and the save file | `game/bundle/` |
| Walking routes, reachability, waypoints, locked-door reach | `game/nav/` |
| Talking to the local model: one checked answer, or a streamed reply, waiting out a busy one, and carrying the job a call belongs to | `game/sidecar/` |
| Setting the AI up: reading and writing which model services there are, where each one is and what it runs, storing a key that only ever goes one way, asking one whether it answers and what it offers, making one real call through it, and pointing each of the five jobs at one of them | `game/providers/` |
| Asking the local model to write the city's history from the owner's brief and a charter for every kind of place it invents, name the city, the parts of it and every sign on it in batches, write a whole place and the lives of the people in it knowing the locks and screens the plan put there, write the quests to what was asked through those locks, screens and counters and hold them to what the harness can play, pin every call to a seed and tag it with the job it is (history, city, places, quests), and say how far the build has got | `game/scribe/` |
| Conversations with NPCs: each person their own session, the first thing they say when you walk up, what they do and say on a turn, whether their answer was yes or no, what they remember of you, what you learn of them, what they sell and for how much, the word or key a job pays out through them, whether their door opens to you, what they are allowed to do, and the dialogs job every call of theirs is tagged with | `game/talk/` |
| Turning a world into three.js objects, the wet street and the rubbish on it, the lights the buildings throw and the fixtures a room is lit by, the skyline the whole town stands in and which buildings round the player wear their shell or their whole detail, which rooms stay built, where a visitor may stand in a room, what the things in a room stand on, and where art plugs in | `game/scene/` |
| The people: bodies and the heavier build a few of them are cut to, clothes, clips, what they hold, who is doing what, coming out of a stance for whoever talks to them, and talking while their line arrives | `game/cast/` |
| Buildings that look like buildings, their lit windows, their neon signs sized to the fascia, the lamps at their doors and the light each lit thing throws, the subway entrance on a station's doorstep and the camera over a private door, the street lamps drawn from code and the ground they all stand on, from the city kit | `game/kitbash/` |
| Whole buildings out of the committed pack the model authored offline, which one a plot gets and keeps because the world file names it, the glass in their windows and the two things you see through it (a flat panel on most of them, a marched room on the rest), the theme pack every one of those pictures comes from, the balconies over the pavement, their entrances (lit where you can walk in), where the model really put that entrance and the band over it so the kit's lamps and names sit on them, the lit screens on their walls and where the light each building throws comes from | `game/prefab/` |
| Inside a building: furniture generated from parameters, the things you pick up off it, walls made of bays (panels, lit niches, shelves, grilles, strips, windows, the booth over a dance floor) and the light every lit thing in the room throws, the television and what is playing on it, the machines on the desks with their programs printed on the glass, the camera on the wall, the gate of bars across a locked door and how it opens, the lit floor under the dancers, and floors laid in a pattern and a finish | `game/furnish/` |
| Sky, sun and moon, terrain, water, trees, rain | `game/land/` |
| Pedestrians walking the streets: where each is going, keeping out of the cars, who walks with the player, indoors and back out, and when a conversation on the pavement is over | `game/crowd/` |
| Cars driving the roads | `game/traffic/` |
| The car the player drives: getting in, the handling, who rides with them | `game/drive/` |
| The interface: objectives, prompts, the compass strip and which way the job is, the minimap in the corner with the doors you have been through, the conversation down the side and the moves you can click in it, announcements, the loader while a city is written and the veil while a train moves you, the counter you buy at, the screen of the machine you sit at with its lock, its pages and its two games, the quests, map (with its stations), inventory (with what things are worth and the places that are yours), codex, settings (the clock, the sky, the minimap, full screen, and which AI runs which job with the providers behind it) and controls window, the question it asks before it hands you back to the launcher, and how it all looks | `game/hud/` |
| Determinism, ids, results, boundary validation | `game/kit/` |
| The running game: the landing screen your cities are laid out on and picked from, the panel you make a new one in (every field optional, Generate with AI writes any of its five written fields, Save draft keeps what you typed, Generate the city lays the architecture out and Preview blueprint is the camera you turn round it with) or open one somebody sent you from, the shelf each is kept on with its playthrough, the pack somebody built onto one of them and the pack this one grows into, the loader while the model writes one, renderer, the frame loop that streams the city round the player, first-person body, the car it drives and the one a job paid out, the train between stations, the map, the compass, the corner view of the streets round you and the route guide, the codex and the settings the interface is handed, the settings screen at the front door with the same providers and the same five jobs on it, taking a thing and leaving it where a job wants it, opening a locked door, sitting at a screen, what plays on the televisions, buying at a counter and the house a deed buys, the keys for the hour and the weather, who goes out walking, who walks with the player and who comes in through the door with them, wiring, and how the hour is graded | `game/app/` |
| The `gb` command: build a city, to a history you wrote if you have one, pin it to the art it was drawn from and say what its history declared that it would not take, grow a finished one into a pack that applies to it alone, inspect it, check it | `game/cli/` |

## Sidecar

| You want to change | Open |
|---|---|
| HTTP/WS endpoints, SSE shapes, OpenAI compatibility, tool calls, error bodies | `host/src/api/` |
| Text generation, engine selection, llama.cpp/upstream wiring, running a command-line agent as the engine (its scratch directory, its scrubbed environment, killing it when the caller leaves), forcing a tool call in the shape the engine honours and in a schema its grammar can end, stopping the engine when the caller leaves, pinning an answer so the same request comes back the same | `host/src/llm/` |
| Speech recognition, audio envelopes, partial transcripts | `host/src/stt/` |
| Speech synthesis, voices, streaming audio frames | `host/src/tts/` |
| Model cache, integrity check, downloads | `host/src/models/` |
| Which engines exist (a hosted service with a key, a server of your own, or a command-line agent on this machine), where their keys are kept and how they are saved, whether one is reachable and what it can run, and which of the five jobs goes to which of them | `host/src/providers/` |

## Elsewhere

| You want to change | Open |
|---|---|
| Stack and architecture decisions with their rationale | `docs/DECISIONS.md` |
| Which art we ship and under what licence | `assets/registry/sources.json` |
| Getting the art, deriving the normal, roughness and occlusion a generated colour tile does not carry, building the pack, proving it fits the skeleton | `tools/` |
| Seeing inside a build: per stage, what it is told and what the engine settles, the prompt file it is handed, the schema its call is forced against, where each field of the answer ends up, the line the call is issued at, and a sandbox that runs that stage against the model or the offline author and shows the request and the reply as they were (`pnpm lab`) | `tools/lab/` |

## Dependency edges

```
game/kit  <- game/world <- game/forge <- game/bundle
game/kit  <- game/play  <- game/quest <- game/forge   (game/world <- game/quest for its closed lists: access and cars)
game/world, game/quest, game/play <- game/bundle
game/kit <- game/sidecar -> the sidecar's api contract
game/kit <- game/providers -> the sidecar's api contract
game/forge, game/quest, game/world, game/sidecar <- game/scribe
game/kit, game/world, game/quest, game/play, game/sidecar <- game/talk
game/world <- game/nav;  game/kit, game/world <- game/scene, game/traffic
game/world <- game/drive   (the traffic, the car art, the crowd and the player all arrive as ports)
game/scene, game/kit <- game/kitbash <- game/forge
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
