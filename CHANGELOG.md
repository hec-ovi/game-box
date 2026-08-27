# Changelog

What the project does now. Each entry is the present state, not a diff.

## 2026-08-27

**The pavement and the bare ground are generated tiles.** The city floor takes
its pavement from a concrete flag laid six to a four metre tile and its parks
and empty lots from bare compacted earth, both cut seamless by
`tools/textures/tile.mjs` and given their normal and their wear by
`tools/textures/relief.mjs`. The roadway stays the kit's own asphalt, which the
wet film and the road paint are aimed at. Every surface lands on the albedo the
night look is lit against: 0.091 on a neon town's pavement, 0.066 on a park,
0.082 on a vacant lot, 0.042 on the road.

**A downloaded model is measured and fitted before it is adopted.**
`node tools/inspect-glb.mjs <file-or-folder>` prints what a model would cost
against a street car's budget (12,000 triangles, 4 draws, 1024 px) and the
licence out of its own metadata. `node tools/fit-model.mjs <file> --out <dir>`
drops what nobody sees from outside, welds and simplifies to the budget, resizes
the textures and merges the materials, printing every step. Both print the
licence the file carries and fit the model either way.

**The map is the city drawn as its architecture.** The map face of the window
is the blueprint the front door shows before a city is written, standing in the
game: every building a box at its real footprint and storey height, the streets
the ground between them, the parts of town as the shapes their blocks make.
Over it are callouts, a line off each thing worth naming with its name in a
small box, which never stack and thin out to the player, their work and the
parts of town while the whole city is in the view. Picking one, by its callout
or by its row, puts the camera on it and says what is known about it down the
left: which part of town, how far on foot, which step of the story. Down the
right the main line with its steps, the side jobs and the stations, each under
a heading that folds. The interface holds the glass and the labels; the game
draws the city, moves the camera and answers what a thing is. A part of town is
derived once, in `@gb/hud`'s `districtShape`, and both surfaces read it. With
the map up the city behind it stops drawing: 0.4 ms of main thread a frame
against 6.6 ms with the city running, on an 8 block town.

**The AI is chosen per job, from either settings screen.** Two families of
engine: a hosted service reached with a key (OpenRouter), and an
OpenAI-compatible server of your own (llama.cpp, ollama, vLLM). Each carries its
model and address, answers a health check, and runs one real generation on
demand. Five jobs are pointed at them independently: the city's history and its
charters, the names and signs, the places and the people in them, the quests,
and talking to people in game. The launcher's settings screen and the in-game
settings tab show the same state, because both read it from the host.

**A locally installed agent can write the city.** A third family of engine
beside the hosted service and the server of your own: `agy`, run as a command.
It takes a JSON Schema and constrains its answer to it, which is what every
generated thing in this game already is, so the contract is enforced at the
engine rather than checked after it. Measured: a forced call with
pattern-constrained ids came back as a call in 10.8 to 17.6 seconds, none
rebuilt from prose. It carries its own system prompt on every call, about 14,000
input tokens before yours, and it accepts neither temperature nor seed, so a
city written through it is not reproducible from its seed. The prompt goes in on
stdin because a command line is full at 128 KiB.

**Keys live outside the repository.** The host writes them to `.env.local`, mode
0600, git-ignored, through a renamed neighbour so a crash cannot truncate it. A
key goes in from the settings screen and comes back out of nothing: the reply
says whether one is stored, never what it is, and the response schema has no
field one could sit in. An exported variable still wins over the file.

**Every model call says what it is for.** The scribe and the conversation engine
tag each request with its job, so the router has something to route. A request
that names no job goes where everything went before jobs existed.

**A brief can be asked what it would give, without building it.** `Forge.plan()`
returns the architecture alone: the grid, the roads, the named districts, every
plot at its height, and the stations, with no interiors, people, items or
quests. A 20 by 20 city plans in about 100 ms against 440 ms for the full build.

**The architecture can be looked at before anything is written into it.** The
creation form's Preview blueprint opens an orbit camera over the massing, with
the zones drawn as the shapes they are and named over the roofs. No people, no
cars, no weather. About 340 ms from the press to the first frame on a 20 by 20
city, with the renderer loaded only when the button is pressed.

**The creation form keeps a draft.** What was typed survives closing the panel.
Step one carries five actions: Generate with AI, Save draft, Generate the city,
Preview blueprint, and on to the writing.

**A place carries what it is.** The model is asked what each building is, and
the answer now reaches the world file and the codex instead of dying with the
process.

**People repeat what the town says about a place like the one they are in.**
Each kind of place carries rumours, and the person you are talking to is told
them as talk rather than as fact.

**The character brief is laid out in three zones**, most stable first: what is
fixed for everybody, then what is fixed for that person, then what changes this
turn. 75 percent of the prompt now holds still between turns of one
conversation, against about 10 percent before, so a local engine reuses its
cached prefix instead of processing the whole prompt again.

**A rule the engine's grammar cannot enforce is said to it in words.** When a
pattern is taken out of the grammar, or a length is ignored because a pattern
sits beside it, the constraint is written into that field's description. The
reply is still checked against the schema as written, so this changes where the
engine is told, never what it is held to.

**The hosted path calls tools.** Measured through OpenRouter on
`google/gemma-4-31b-it:free`: a named tool choice, streamed, came back as a
whole call in about 2.1 s, not rebuilt from prose. What limits it is capacity,
not correctness: the free pool answers 429 for long stretches.
