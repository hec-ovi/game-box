# Changelog

What the project does now. Each entry is the present state, not a diff.

## 2026-08-30

**`pnpm dev` starts the game and the sidecar together.** The page at 5180 and
the model endpoint at 8976, one process, Ctrl-C stops both. The engine behind
the sidecar is still whoever `.env` points at.

## 2026-08-28

**A model writes every word of a city.** The history, the city and zone names,
the sign over every door, the people and the work all come from a model and
from nowhere else. The writer that composed them by arithmetic is gone, with
the thirty source files that fed it: the quest recipes, the people writer, the
history composer and its wording tables. A stage the model will not write stops
the build and names itself.

**The architecture is arithmetic and takes no narrator.** `Forge.plan` is
static and answers straight away: streets, roads, zones, plots and storeys,
everything under placeholders (`Zone 1`, `Instance 1`). Every box that only
wanted geometry asks for that instead of building a whole town. Forge's own
tests of a written city replay a recorded model run and throw on any question
the recording does not hold.

**A quest step says where it sends you.** A step whose words name a building
other than the one its ids point at is refused and rewritten, quoting the
placeholder it should have used, and so is a step naming somebody who stands in
a different instance. This is checked on the model's answer, because at the id
level a person already belongs to exactly one place and the leak was only ever
in the free text beside the ids.

**A town boards nowhere, or in at least two places.** One station in a town is
an entrance with nowhere to ride to, so the count is floored at two wherever a
town boards at all. Standing at the only station there is, the map says so.

**The marker counts the walk down as you walk it.** The whole route is kept
between measurements, corners already passed are dropped each frame, and the
distance is the metres left, which cannot rise at a corner.

**`gb build` writes a city through the model.** There is no flag to ask for one
written any other way. The blueprint preview shows the architecture with no name
on it, and the pipeline sandbox runs its stages against the model alone.

## 2026-08-27

**The model writes the story, the engine builds the flow.** A quest comes back
from the model as beats: what happens, who it involves, where, and what thing,
in the order it happens. `@gb/quest`'s compiler turns that into the flow, and
that is where the step ids, the edges, the fork and its roads coming back
together, the pick-up in front of the hand-over that needs it and the ending
come from. A beat naming somebody the city has not got is a refusal quoting
that id, never a repair. The tool the model decodes against went from 12,942
characters of step graph to 7,140 of story.

**A lock is opened by the city, not by the writer.** Getting the key out of the
keeper's pocket before the door, or the code out of somebody on the floor
before the screen, is put into the run of beats before it is compiled, with the
conversation written to that person at that place. A lock with nobody in the
place to ask is left shut and the writer hears about it. The bill for what a
job buys is added up from the counters' own prices and goes on the quest as the
money it takes to be offered it.

**A locally installed agent writes the whole city.** A command-line agent runs
the model its own provider names and never the one the request carries, because
a model name in a request is a word out of an HTTP service's catalogue: the game
asks a server of its own for `default`, and handing that to an agent on this
machine exits 1 with nothing on stderr. Measured on an 8 by 8 city written
through `agy` on `gemini-3.7-flash-low`: 562 buildings, 90 people, 52 quests and
no call refused, in 468 seconds. The same
build before this was 21 refusals in 24 calls.

**A city has a downtown.** How tall a plot builds is read off how near the
middle of the grid its door stands, pushed out along the avenues: past the band
the catalogue is drawn for, the kit stacks a storey of wall at a time. On a 20
block town 15.5% to 17.3% of the plots clear the band, the tallest at 23 to 24
storeys, the core standing at a median of 6 and the edge keeping to the band.
Standing at the spawn that is 333,501 triangles in 11 draws, against 79,070 in 6
with the ceiling at 4.

**A door is a face, and a window is a face.** The model says where its entrance
plate stands, and that patch of the wall's own uv is written onto the wall
behind it, so the bay grid drops every bay the door reaches. The opening, the
pane over it and the room behind it are cut from the same place.

**A wall picture is read at the metres of wall under it.** The pictures are
generated over a two metre frame, so the shader measures the surface and reads
them at that size rather than at the uv the producer laid. Brick is brick sized
on a twelve metre front and on the metre of fascia over a door.

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
