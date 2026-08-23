# Pending

## The definitive list (2026-08-23, evening)

Everything below is checked against the code, not against a report. Ordered by
what a player notices.

### Blockers: things that lose work or contradict the direction

1. **A refresh with the model on wipes the playthrough**, and the fix is now
   known to be the other one. `host` carries `seed` and `temperature` end to
   end, but reproducibility cannot be bought: OpenRouter was measured at three
   different cities from one seed at temperature 0 (`stealth/ox-alpha` does not
   honour a seed), and llama-server's own defaults are a fresh random seed at
   temperature 1. Even `--parallel 1` locally only holds while nothing else
   talks to the engine, which is false once NPC dialogue runs during a build.
   **So `Bundle.resume` must tolerate a regenerated city rather than clearing
   the save.** Box: `bundle`, with `sidecar` sending seed and temperature for
   what it is worth, and `scribe` deriving a per-call seed by position.
2. **Neon lights nothing.** There is no `PointLight`, `SpotLight` or
   `RectAreaLight` anywhere in the game, so a wall beside a burning sign is lit
   by moonlight. The whole art direction is "neon is the light source". Boxes:
   `kitbash`, `scene`.
3. **No loader.** `@gb/scribe` publishes a progress port, tested, and nothing
   passes it, so minutes of model work sit behind one static line instead of
   "generating the city, generating locations, generating the main quest". Box:
   `app`.

### Features asked for, no code

4. **Packs.** The blocker is gone (a world file records what it was built from
   and every plot is pinned), but nothing packages a pack or applies one.
5. **Open place kinds.** A city should contain a jail or a university because
   the premise called for one, with neither word in the engine. In design; the
   evidence is `docs/PLACES-SURVEY.md`.
6. **Minigames**, and a score that survives.
7. **Lip sync.**
8. **Real windows and balconies.** The pane is a 1.5 cm opaque emissive slab;
   balconies are filtered out of the building pack.
9. **Streaming or level of detail.** Everything loads at open.
10. **The second wave** (his own notes, section below): usable terminals and
    computers, security cameras, hacking and passwords, doors with steel bars,
    access cards, credits and buying, quest-unlocked cars and items, subway
    fast travel, an apartment of your own.

### Small and known, with a measurement behind each

11. **No clip sits a body on a raised seat**, so bar stools are 33 cm out (four
    in a nine-plot city). `@gb/forge` anchors `sit-drink` on chairs meanwhile.
    Box: `cast`.
12. **The bed is 6 cm too short**: pad 1.837 m against a 1.92 m body with boots.
    Boxes: `furnish`, then `forge` follows.
13. **Worktops rise 10 cm** now that `worktopHeight` is measured at 1.0. What
    needs a look: anything drawn under a worktop, and whether a shelf's ledges
    still fit. Box: `furnish`.
14. **Play the nod and the shake** on `@gb/talk`'s new `answered` event. One
    case in the event loop. Box: `app`.
15. **`Game`'s constructor still has no test** without a headless seam; it has
    cost two shipped crashes. In flight.

### Red when the day ended (2026-08-23, 19:05)

Four tests, all one cause: `METRICS.worktopHeight` went 0.9 to 1.0 and the
geometry drawn against it moved. `@gb/furnish` was mid-pass on exactly this when
the day ended, so some of it may already be gone.

- `game/furnish/tests/heights.test.ts` — with furnish; the assertion is also
  unsatisfiable for a second reason (7 is now the reachable maximum).
- `game/scene/tests/blockers.test.ts` and `pickups.test.ts` (x2) — downstream of
  furnish's geometry. Needs a scene pass **after** furnish lands, not before.

`game/bundle/tests/published-schema.test.ts` was the fifth and is fixed: the
schema embeds `@gb/world`'s shapes and went stale when the premise field landed.
Regenerated and pushed.

Everything else: 954 of 959 green, `tsc --noEmit` clean, isolation clean across
22 boxes and 712 files.

### OpenRouter: verified working, two things to settle (2026-08-23, 19:40)

The endpoint is live. `stealth/ox-alpha` served a reply in 1.26 s at zero cost,
key authenticating, provider Stealth. The 404 that came first was an account
data-policy setting, not our code: every model returned it, and
https://openrouter.ai/settings/privacy cleared it.

Two probes did not pass and neither is settled:

- **A forced tool call came back empty.** `tool_choice` naming the function
  returned `content: null` with no `tool_calls` array. The owner says the model
  does support tool calls, so the probe was probably wrong, not the model:
  likely candidates are needing `stream: true` (the whole pipeline streams),
  the reasoning field carrying the call, or a shape difference from
  llama-server. **This is the first thing to check next session**, because every
  generated thing in the project is a forced tool call whose parameters are the
  validating contract's JSON Schema. Nothing works through OpenRouter until it
  does.
- **`seed` plus `temperature: 0` did not reproduce.** Three identical requests
  gave three different answers. So the hosted path is not automatically the
  easy answer to determinism, and the honest fallback stands: `Bundle.resume`
  tolerating a regenerated city rather than clearing the save.

`.env` exists at the repo root, gitignored, holding `OPENROUTER_API_KEY`,
`GAME_BOX_LLM_UPSTREAM` and `GAME_BOX_PORT`. Nothing loads it yet: the host
reads `process.env` directly, so it needs exporting or Node 22's `--env-file`.
The agent wiring OpenRouter into `host/` has that plus keeping the key out of
every error path.

### From the facade pass (2026-08-23, 20:30)

- **`@gb/kitbash` blocks strip-only mode.** `src/kit/error.ts:5` uses a
  TypeScript parameter property, and `@gb/prefab`'s entry pulls kitbash in, so
  `node --experimental-strip-types -e "import '@gb/prefab'"` throws. Three
  lines.
- **The plot shape band is written down twice.** `FRONTS`/`DEPTHS`/`STOREYS`
  live in `game/prefab/src/bucket.ts`, but "3 to 6 cells of frontage by 5 to 8
  of depth" is a fact about how a city is cut, not about art. It belongs to
  whoever cuts plots. Then `--cells 12` producing 37 out-of-band plots is a
  named forge bug rather than a coverage coincidence. Prefab's view, which I
  share: hold the generator to the band, do not widen the pack (one more front
  and depth takes 512 models to 800 and the mesh 3.1 to 4.8 MB, and only moves
  the cliff).
- **The biggest remaining quality lever in the city, found and not taken:** on
  the three looks that show the most wall, 42 to 44% of the street face is the
  producer's plain `base` finish, visually identical across all four families.
  Giving each look's base the same picture as its facade costs four layers
  (2.8 MB) and beats any remaining variant choice.

### `theme` is a keyword bag, not a description (2026-08-23, found by him)

> "theme? why theme? i want to specify what is it about, etc, if i put a long
> prompt there will work?"

No. `theme` is `z.string().min(1).max(60)` in `game/world/src/model/schema.ts`,
so a long prompt is refused rather than truncated. Offline it is not read as a
sentence either: `game/forge/src/theme/flavour.ts:22` splits it into words and
matches a keyword set.

What he wants already has the right consumer and is not connected to it. The
premise writer turns what a town is about into its history, and everything
downstream is built from that, but it currently receives only the same
60-character theme.

The shape: a **brief** in his own words, unbounded, going straight to the
premise writer, with `theme` kept as the short keyword hint the offline author
needs. That means a field on the world document (so a shared city remembers what
it was asked for), a parameter on `Forge`, and a place to type it. It is the
same gap as the creation panel, and this is the sharper version of it.

**And he wants more than a premise in it.** "if i want specific quests, styles,
kind of game, etc". Four asks, and only two are reachable by prompt. Say so
rather than building a box that quietly ignores half of what is typed:

| ask | consumer | reachable |
|---|---|---|
| what the city is about | the premise writer | yes, today |
| what the quests should be about | `write-quest.md`, which has no such hole; the premise does not even reach it yet | yes, prompt work |
| the style or period | the art catalogue: 8 building looks, 12 facades, 12 outfits on one skeleton | **no.** A medieval brief gives a cyberpunk town with medieval names. Style is assets |
| the kind of game | the loop is quests because that is what the code does | **no** |

So a brief is separate fields for separate consumers, not one text box. And the
two that cannot be honoured should say so in the interface rather than be
silently dropped, which is the failure this project has spent a day removing.

### The way out exists and nobody can find it (2026-08-23, found by him)

> "i can not exit, how is possible after 2 days we did not added an exit?"

**`N` toggles the boot panel**, `boot.ts:207`, and `Boot.showPanel()` hands the
keys over and shows it correctly. It is documented **nowhere**: not in the
controls tab, not on the bottom bar beside QUESTS / MAP / ITEMS / CONTROLS, not
in the README. He played for two days without an exit that was already built.

So the defect is discoverability, and it is worth taking seriously as a class:
a control nobody can find is the same as a missing control, and this project has
now shipped one of each (the route guide also worked for a day with no button).

What it needs:
1. `N` in the controls tab and on the bottom bar, named so it reads as leaving.
2. A **library** in the panel: the worlds this player has made or been sent, the
   one they were last in marked, open and remove. Saves are keyed per world
   (`game-box.save.world_0001`), so the data exists and nothing reads it as a
   list.
3. An audit of every other binding for the same fault. `G`, `T`, `K` and `P` are
   bound in `interaction.ts`; check each appears where a player would look.

Boxes: `hud` for the bar and the tab, `app` for the library.

### A rate limit is reported as an upstream failure (2026-08-23, seen live)

OpenRouter answered `429` and the sidecar surfaced `502 Bad Gateway`, so the
game treated a temporary cap as a dead endpoint and retried in a tight loop,
filling the console. `stealth/ox-alpha` is free tier and free models are capped
per minute and per day, so this is the normal path, not an edge case.

What it needs: `429` distinguished from a real upstream failure, honoured with
the `Retry-After` header when present and a backoff when not, surfaced to the
player as "the model is busy" rather than as a failure, and **never** retried
tightly. Boxes: `host` for the classification, `@gb/sidecar` for the backoff,
`@gb/app` for what the player is told.

Related and already known: an engine that dies mid-reply now ends with
`finish_reason: "error"` rather than claiming success. A 429 deserves the same
honesty.

### On screen, from his own screenshots (2026-08-23, 19:43-19:47)

Three, all visual, all in the look boxes. Screenshots in `~/Pictures/Screenshots/`.

1. **`light_colums_over_doors.png` — the light columns are enormous.** Standing
   at a doorway, two vertical strips run floor to roof at full white, wider and
   brighter than anything around them, and they wash out the entrance they are
   meant to frame. They read as geometry, not as light. Whatever their intended
   size is, at door distance they dominate the frame. Boxes: `kitbash` (the
   strip) or `prefab` (the entrance).
2. **`displays_wrong_proportion_ugly_borders.png` — the screens.** The portrait
   advert is stretched to the panel rather than fitted, so the face is wrong,
   and every panel carries a thick glowing border that reads as a frame around a
   picture instead of a lit screen. The same shot also shows **loose white light
   bars floating clear of any surface** across the building and out over the
   street, at angles that match no wall. Box: `prefab`, and the floating bars
   may be `kitbash`.
3. **`bald_people_wrong_hair_render.png` — hair is not drawing.** Reported by
   the shot's own name; not yet opened and read in detail. Box: `cast`.

Worth noting what these three have in common: every one is a lit thing being
drawn too big, too bright or in the wrong place. That is the same family as the
missing point lights, and it suggests the emissive pass is doing too much work
because nothing else lights anything.

### The periodic freeze: found and fixed (2026-08-23, 20:00)

**Cause.** `Stage.reflect` prefiltered the sky into a **new** render target every
time the hour turned and assigned `scene.environment` the new texture. The
environment is part of every render object's shader cache key in three, so a new
texture object rebuilds the shader of every object in the scene. Measured on
this machine's WebGL2 fallback: **a 200 ms stall, four times a real minute** at
the default clock rate. Filtering the dome itself costs 1.4 ms, so 99% of the
cost was the rebuild, not the work.

**Fix.** Filter into the same render target every time, so `scene.environment`
is the same texture object it was an hour ago. `game/app/src/renderer.ts`, nine
lines. 140 app tests green, `tsc -p game/app` clean.

**Not verified on screen.** The agent was killed mid-pass while clearing stray
processes, after it had confirmed the mechanism in three's source and written
the fix. The before and after frame distribution was never captured, and there
is no test guarding it. Next session: run it, confirm the hitch is gone, and
decide whether a frame-time regression test is worth having.

### Things overlap on screen (2026-08-23, reported, not diagnosed)

His words: "and things are overlapping, etc". No screenshot yet. Given the
panel, the hud window, the objectives corner, the notices and the conversation
all draw over the same canvas, the likely candidates are a missing z-order
between the panel and the hud, or the notices column running under the objectives
box. Needs a shot or a reproduction before anyone changes a style. Box: `hud`,
possibly `app` for the panel layering.

### People walk through cars (2026-08-23, found by him)

Cars brake for people as of today, but nothing stops a walker entering a car.
`@gb/crowd` reads `cars()` through its `Hazards` port to decide **when it is
safe to cross**, and never as a solid to steer around, so a stopped or passing
car is empty space to a pedestrian.

It shows worst in the case today's changes created: a car now stops for somebody
in the road, and that person then walks straight through the stopped car.

The two halves are already published, which is why this is cheap: `@gb/traffic`
exposes car positions and `@gb/crowd` already has a solid-avoidance path for
walls and for other people. What it needs is a car counted as a moving obstacle
in the steering, not only in the crossing decision, and a rule for the case where
a walker is already inside one (the player's version of this was fixed by pushing
out rather than blocking, and the same answer probably applies).

Watch the cost: the crowd steers every walker every frame, and traffic's own
lesson today was that a naive per-walker scan over every car is the wrong shape.
Traffic solved its side by indexing people to lanes once at load, 2 to 3.5x
cheaper than the scan it replaced. The same trick is available here.

Box: `crowd`, reading `@gb/traffic`'s published positions.

### A turn is two things, and the model returns one blob (2026-08-23, found by him)

A real reply from the running game:

> "The grease in this pan is singing louder than anyone in that booth. Jarl is
> polishing a glass that's already clean because he's got nothing better to do.
> What do you want?"

Two sentences of narration and one of speech, arriving as one string and drawn
as if she said all of it out loud. His read, and it is right: **the tool should
carry two fields, what she does and what she says.**

Why it is worth more than tidiness:

- **The panel can draw them differently**, so stage direction stops masquerading
  as dialogue.
- **`does` is what the gesture layer has been missing.** `@gb/talk` publishes
  `answered` (yes or no), which drives a nod or a shake and nothing else. A
  described action is something a body could actually perform, and `@gb/cast`
  now has 28 clips and 4 gestures to perform it with.
- **It constrains the model usefully.** Given one field, a model narrates into
  the dialogue. Given two, the narration has somewhere to go.

Shape to settle: `does` is optional (most turns are only speech), it is prose
rather than a closed set (a closed set of actions would be the overfitting the
owner rejected for places), and mapping prose to a clip is a separate step that
may simply fail and play nothing. Do not let the model name clips.

Note the property-order trap this project has already been bitten by twice:
llama emits properties in schema order, so `does` before `says` means the action
is decided before the line is written, which is the order that makes the line
follow the action rather than the reverse.

Boxes: `talk` for the tool and the event, `hud` for drawing them apart, `app`
for handing `does` to the gesture layer.

### A conversation shows one line at a time (2026-08-23, found by him)

"CHATS do not have history, they should." The panel draws the latest reply over
the last one, so a conversation has no scrollback: you cannot see what you asked,
what they answered two turns ago, or what you have already been told.

**The data is already there.** `@gb/talk` keeps the full transcript, which is how
the model has context across a turn, and today's greeting work explicitly puts
the opening line into it as the NPC's own turn. Nothing needs generating; the
panel needs to render a list where it renders a line.

Worth settling while doing it, because they interact:

- **Whose turn is whose.** The player's words and the NPC's need to read apart.
- **`acted` and the coming `does`.** `acted` is already the line for the turn in
  front of the player, and the does/says split above adds a second thing per
  turn. A history that shows only speech throws both away; one that shows
  everything is a wall of text. Decide what a past turn keeps.
- **Where it ends.** A conversation can run long. Scroll, or a cap, or both.

Box: `hud`, with whatever `@gb/app` must push from the transcript.

### NPCs answer with the last place's context (2026-08-23, found by him)

The worst one from his session. Characters do not know who they are or where
they are, and the sharpening detail is his second report: **they behave as if
they are in the instance he was in previously.**

That is stale state, not missing state, and it almost certainly explains both
symptoms with one cause: a brief, a `Situation` or a `Conversation` built once
and reused, so it still describes the place, the people and the stock of
wherever the player was last. A brief carrying the wrong place would also carry
the wrong person.

**The prompt is not the fault.** `game/talk/prompts/npc.md` opens
`You are {{name}}, the {{role}} at {{place}}, in {{city}}.` and goes on through
personality, surroundings, what they know for a fact, standing and situation.
`brief.ts` reads `npc.name` and the world name. Template and reader are both
correct.

**Where to look, in order:**

1. **Lifetime.** What owns the `Situation` and the brief, and when is it rebuilt?
   If it is constructed with the game or with the first conversation rather than
   per conversation, that is the bug outright.
2. **`Buildings.enter` / `leave`.** Does anything tell talk the player changed
   building? `@gb/app` publishes `peopleHere()` and `cityPosition()`; if the talk
   side reads a place captured at construction, entering a new one changes
   nothing it can see.
3. **Reuse across NPCs.** One `Conversation` reused for a second speaker would
   carry the first speaker's transcript, which would also give the model the
   wrong name to echo.

**Reproduce before changing anything:** talk to somebody in building A, walk to
building B, talk to somebody there, and print the brief that goes out on the
second conversation. Compare it with the first. Do not fix on a hypothesis; two
of the three above look identical from the player's seat.

Box: `talk`, possibly `app` if the fault is that nothing tells talk the player
moved.

### The interface, from playing it (2026-08-23, his list)

Four, all `@gb/hud`. The first two are one job with the conversation history
above, because a panel that jumps as text arrives cannot hold a scrollback
either.

1. **The conversation window resizes as the NPC speaks.** It should be a **side
   panel of fixed width**, toggled when you interact and dismissed when you
   leave, so the text fills a stable frame instead of the frame growing to the
   text. This is what makes history, the does/says split and a long reply all
   possible; done separately they will each fight the layout.
2. **Coins belong in the inventory**, not floating in the corner. Money is a
   thing you carry.
3. **The tab is called Items and should be called Inventory.** His word, and it
   is the better one: an inventory is what a player expects to press `I` for.
4. **The map shows no quest locations.** It draws the city, the plots and the
   player. It should mark where the open steps send you, and **the main line
   needs a different marker from a side job** — the journal already sorts main
   above side and tags it, so the fact is published and the map ignores it.

On 4, the parts exist: `@gb/quest`'s journal carries `kind` per quest and each
step's target, and `@gb/app` already resolves a step to a doorstep for the guide
and the arrow. So the map is reading less than the game already knows.

### Night arrives in one step (2026-08-23, found by him, twice)

"night happens all at once, very aggressive". He reported the same thing earlier
as "the sky moves by snaps", so this is confirmed rather than a first sighting.

**The cause is that the sky is updated on the hour turn, not continuously.**
That is the same code path as the freeze: `Stage.reflect` refilters and the light
is reset when the hour changes, so the whole world's lighting moves in one-hour
jumps. Between jumps nothing changes at all.

**Slowing the clock today makes this more visible, not less.** The jumps are the
same size; they are now two and a half real minutes apart instead of fifteen
seconds, so each one reads as a light switch rather than as a flicker. That is a
consequence of the clock change and it is on me to say so.

The fix is to make the light continuous and keep the expensive part occasional:

- **Sun and moon direction, colour and intensity should move every frame**, off
  the fractional hour rather than the whole one. That is arithmetic and costs
  nothing.
- **The environment prefilter can stay occasional.** It is 1.4 ms and it is the
  part that must not run per frame. `scene.environmentIntensity` and
  `scene.environmentRotation` are cheap and can carry the drift between filters,
  which is what they are for.
- Check what else is stepped on the hour: lamps coming on, window lights, the
  street's wetness and night factors, the crowd's day and night behaviour. If
  any of those switch on the same edge, they all snap together and that is why
  it reads as aggressive rather than as dusk.

Boxes: `app` (the stage and the clock wiring), `land` (sun, moon, sky), possibly
`scene` and `kitbash` for anything else keyed to the hour.

### The doorway is wrong: columns, ads and frames (2026-08-23, his repeated report)

Reported three times now, so it is the most visible fault in the game. From
`light_colums_over_doors.png`, `displays_wrong_proportion_ugly_borders.png` and
`Screenshot From 2026-08-23 20-14-56.png`.

1. **The light columns flanking a door are wrong.** Two vertical strips run the
   full height at near-white, wider and brighter than anything near them. They
   read as geometry rather than as light and they dominate every doorway shot.
2. **Adverts are placed over the door.** A banner sits directly beside and above
   the entrance, competing with the sign and the doorway rather than sitting on
   wall. Placement, not just appearance.
3. **The panels have frames, and should have none.** His words: "the display ads
   have an ugly frame, should not have frames at all." Today each panel gets a
   12 cm housing measured off the surface derivatives plus a 3.5 cm rim light
   inside it. That housing is the frame. Remove it: a screen should be the lit
   image and nothing else.
4. **The image does not fill the panel.** The bowl advert renders as an orange
   band in the bottom fifth with empty grey above, and the 5 cm lamp grid reads
   stronger than the picture under it. Check the uv span per panel first (a
   panel is meant to cover exactly one picture) before touching grid strength,
   because a wrong span would explain both the emptiness and the earlier
   stretching.

All `@gb/prefab`, except the columns which may be `@gb/kitbash`. Take them
together: they are one doorway and they are being judged as one thing.

Worth remembering while fixing: every one of these is a lit thing drawn too big
or too strong, in a game with no point lights, where the emissive pass is
carrying the entire look on its own.

### Signage is enormous and overlaps itself (2026-08-23, `overlapping_labels.png`)

The worst thing on screen. At a shopfront: letters several metres tall, a
horizontal fascia sign and a vertical blade sign occupying the same space and
drawn through each other, and light strips crossing the letters at angles that
match no surface. It fills the view from the pavement and nothing else is
readable.

This is the same family as the doorway entry above and probably the same cause,
so look at them together: **things that emit are being sized without reference
to the wall they are on.** A sign, a light column, a banner and a strip each look
plausible alone and collide when four of them land on one shopfront.

What to check, in order:

1. **Absolute size.** Letter height should come from the fascia's own height, not
   from a constant. Measure what a metre is on that wall and cap against it.
2. **Claiming space.** The building pack already has a rule for this: on a facade
   every element claims the cells it stands on so two can never overlap. Signage
   appears not to go through that, which is why a blade and a fascia can share a
   spot. That mechanism exists and is the answer.
3. **The strips are not on any surface.** They cross letters at arbitrary angles,
   so whatever places them is not reading the wall plane.

Boxes: `kitbash` owns the sign and its words, `prefab` owns the facade and its
cell claiming. The fix likely belongs where the claiming already works.

### Interiors seen from the street: too deep, and too few (2026-08-23, his read)

Two reports and he connected them, plausibly: "generate more variety of places
the assets i mean, the interiors, and they are too distant the inside, so maybe
if we fix that, we also fix that repeated wall issue".

**Check the depth first, because it may be the whole thing.** A room behind glass
is parallax raymarched into a box, and the box's depth decides whether a room
reads as near or far. Set too deep, every window looks down a tunnel: you see
less of the room's own picture and more of the same dark side walls, which makes
fourteen distinct rooms read as one repeated wall. That is exactly the pair of
symptoms he describes, from one number.

So: measure what the depth is against what a room actually is (a 3 to 5 m deep
shop floor, not a corridor), fix it, and **then** judge whether variety is still
short. Generating more rooms first would be paying for pictures that the depth is
hiding.

If variety is still short after that, it is cheap: the pack went 12 rooms to 14
today and `draw-rooms` now takes whatever raw images it is pointed at, so one new
room lands alone. Each is 0.35 MB against a 200 to 300 MB ceiling at 72 MB, and
`docs/textures/IMAGES.md` has the working prompt and the two corrections that
matter (the "straight through its window" clause makes the model draw a window
frame around the room; use "camera perpendicular to the far wall so the room
fills the whole frame edge to edge").

Box: `prefab`.

### Interior ceilings are pure black (2026-08-23, `roof_black.png`)

Walls, floor and furniture read well; the ceiling is flat black. That is
diagnostic, not random: **nothing lights a downward-facing surface.**

The light strips along the wall and ceiling junction are emissive geometry, so
they light nothing. `@gb/furnish`'s interior probe is direction-only and its
lower hemisphere is near-black, so a ceiling normal pointing straight down
samples black while walls and floor sample the lit upper half. Furnish measured
this from the other side today: a lit television is about a fiftieth of a room's
light, because two square metres of ceiling cove at 3.2 against half a square
metre of glass is fifty to one. The cove is doing the work, and it cannot light
the thing it is mounted to.

Three ways out, cheapest first:

1. **Give the probe a lower hemisphere.** It is painted from the language's own
   floor, wall and ceiling colours; a ceiling looking down at a lit floor should
   not sample black. This may be the whole fix and costs nothing at runtime.
2. **A ceiling fill**, a small constant on downward normals, which is the cheap
   fake and reads fine in a room this size.
3. **Real lights.** The strips become actual lights, which fixes this, the
   invisible garment sheen, the oversized emissive doorway and the aggressive
   night in one move. It is the standing blocker.

Note the same physics applies outdoors: any surface facing down (a soffit, the
underside of a balcony, a parapet return) will be black for the same reason.
Worth checking before deciding this is an interior bug.

Boxes: `furnish` for the probe, `app` and `scene` for the fill, `kitbash` if it
becomes real lights.

### Daylight is flat and cartoonish (2026-08-23, `daylight_cartoonish.png`)

Night reads well; day does not. In the shot: pale grey-blue everywhere, no
shadows on the pavement, buildings and ground at nearly the same value, the
generated facade pictures not reading at all, and the kit's pale brick beside
them. It looks untextured and unlit.

**The cause is almost certainly that everything was tuned for night.**
`docs/LOOK.md` is a night document, every material decision this project has
made was judged under neon, and the facade sampler divides each picture by its
own mean and multiplies in linear against a near-black target. Point that at a
daylit sky and the differences compress to one value, which is exactly what the
shot shows.

What to check, in order:

1. **Is the sun casting at all?** No shadow is visible anywhere. The shadow map
   was enabled and measured at 2.49 ms, so it exists; whether it is on in
   daylight, and whether the sun has any intensity above the horizon, is the
   first question and the cheapest.
2. **The grade and exposure.** There is a cold night grade. Is there a day one,
   or does the night grade run all the time? A grade built for neon on black
   will flatten a lit scene.
3. **The facade contrast.** Those walls should be showing the generated
   cladding. If the divide-by-mean normalisation is calibrated for a dark target,
   daylight may be pushing the result past where the grain survives.
4. **Whether day is worth having at all.** Honest question rather than a
   rhetorical one: the game is cyberpunk at night, the whole asset set is built
   for it, and the clock passes through noon every real hour. Either day gets its
   own treatment, or the day-night range gets narrowed so the city stays in the
   hours it was designed for. Deciding that first would save tuning something
   nobody should see.

Boxes: `app` for the grade and exposure, `land` for the sun and sky, `prefab`
for how the facades hold up under it.

### A phone idle with no phone (2026-08-23, `broken_hands_phone.png`)

An NPC stands with one arm raised to the ear, fingers curled round nothing, the
wrist at an angle that reads as broken. The clip is `Idle_TalkingPhone_Loop`: it
is posed to hold a phone, and nothing is in the hand.

It is not rare. That clip is on the `stand` shelf and was added to `guard`
today, and `Idle_WallPhone_Loop` and `Sitting_Phone_Loop` were added to `lean`
and `sit` in the same pass. So a meaningful share of standing, leaning and
seated NPCs are miming a call with an empty hand.

Two honest fixes, and the choice is `@gb/cast`'s:

1. **Put a phone in the hand.** `@gb/furnish` already builds a `phone` item
   (75x155x10 mm, lit screen, earpiece slot) as one of the 25 archetypes, and
   `@gb/cast` already parents things to the rig. A prop attached to the hand bone
   for the length of the clip is the honest version and it makes the pose read.
2. **Drop the phone clips from the shelves** until something can hold one. Fewer
   idles is better than a broken one, and today's pass widened those shelves from
   one clip to three or four, so there is room to lose one.

The same question applies to any clip posed around an object: check whether
`Idle_WallSmoke_Loop` has the same fault, and whether the drink clips added today
put a hand where a glass should be with nothing in it.

Box: `cast`, with `furnish` if a real phone is attached.

### Every person is their own session, with their own life (2026-08-23, his design)

His words, and this is a design requirement rather than a defect:

> "we want context for the people in the city, where are they? who are they?
> different histories of life they can have and talk, so if they are on an
> instance there must be a reason, if they are walking they are going somewhere,
> or doing something, not just random like 'the sky is holding' or 'its clear,
> and indifferent, blah blah' things totally out of context, so each character is
> its own session chat with its own memory and context, is not a single session
> for all characters"

Four things, and the last one is architectural.

1. **A person in a building has a reason to be there.** Not "an NPC at an
   anchor": this is their shift, their shop, their room, their appointment. The
   narrator already writes a personality and what they know; what is missing is
   why they are standing in that spot at this hour.
2. **A person on the street is going somewhere.** Walkers currently wander a
   route. They should have a destination and an errand, and be able to say so.
   `@gb/crowd` already routes them between points, so the fact exists in the
   simulation and never reaches the conversation.
3. **A life, not a role.** Each has a history they can talk about. The premise
   gives the town one; a person needs their own, small, and consistent every time
   they are asked.
4. **One session per character, with its own memory.** Not one shared session.
   Each person remembers what *they* were told and what *they* said, across
   conversations, and knows nothing of a conversation they were not in.

**Point 4 is very likely the cause of the stale-context bug already logged.** If
one session or one situation is reused across speakers, an NPC inherits the last
one's place and transcript, which is exactly the reported symptom: characters
answering as if they were in the previously visited instance. Fix the
architecture and that defect probably goes with it. Verify that rather than
assume it, but check it first.

**Also kill the weather filler.** The greeting's middle slot falls back to the
weather, which is how "the sky is holding" reaches a player as a character's
opening line. A person with a reason to be somewhere has something better to say,
and the fallback should be their own business, not the sky.

Cost worth thinking about early: a session per character means a transcript per
character in the save, and a city has hundreds of people. Decide what a person
remembers and for how long before building it, or a world file grows without
bound.

Boxes: `talk` for the sessions and the memory, `forge` for the reason and the
life at generation, `crowd` for a walker's destination and errand, `play` for
what persists.

**Extended, 2026-08-23:** "we want complex intricate simulation, they have their
own context, etc, so whatever you share they remember, etc."

So a person's memory is not only their own history, it is **what the player told
them**, and it changes how they answer later. That makes a conversation
consequential rather than a vending machine: tell the barman you took a job from
his rival and he knows it next time.

Three things that follow, and they should be decided together rather than
discovered:

- **What is worth remembering.** Not the transcript. A small set of facts a
  person now holds, each with where it came from. A transcript per person across
  a city of hundreds is a world file that grows without bound; a handful of facts
  is not.
- **Does it spread?** He said they remember, not that they gossip. But once a
  person holds a fact, whether it reaches anyone else is the next question and
  it changes everything: knowledge that spreads is a simulation, knowledge that
  sits is a memory. Ask before building, because the storage and the model cost
  are very different.
- **The player has to be able to see it.** A person who silently knows something
  is indistinguishable from one who does not. Whatever they remember has to
  surface in what they say, or it is invisible machinery.

This is the largest unbuilt thing in the project and it is worth a design pass of
its own, the way `docs/PLACES.md` was, rather than being started from a brief.

### A quest sends you to somebody who is not there (2026-08-23, found by him)

He was sent to find a person and the room was empty.

**This is a gap in the completability number, not just a bug.** `@gb/forge`'s
harness reports 444 of 444 quests completable, and that is honest as far as it
goes: it credits only through the events a real player can produce. But it runs
headless, where nobody leaves their post. In the running game `@gb/app` sends up
to **a third of a town out walking** at any moment, so a step naming one of them
points at an empty room. The harness cannot see that, which is why a green number
and a broken errand coexist.

Three ways it could be answered, and the choice matters:

1. **Quest targets stay put.** The simplest: a person who is the target of an
   open step is not eligible to go out. `@gb/app` already owns who is out
   (`Street.residents()`, which honours "nobody is the last person out of a
   room"), so adding "and nobody with a job waiting on them" is one rule in a
   place that already has two.
2. **The guide points at where they actually are.** More alive, and it fits the
   walkers-going-somewhere design above: the marker tracks the person rather than
   their post, and finding them in the street is part of the errand.
3. **They come back.** A person with somebody waiting returns to their post.

1 is the safe fix and 2 is the better game. They are not exclusive: 1 now, 2 when
walkers have destinations worth following.

**And the harness should learn about it either way**, or this class of fault will
keep passing. It should drive at least one playthrough with people leaving their
posts the way the running game does, so "completable" means completable in a
living city rather than a static one.

Boxes: `app` for who goes out, `forge` for the harness, `hud` and `app` for the
marker if 2 is taken.

### The weather is one line in three, by construction (2026-08-23, measured)

He noticed people keep talking about the sun. He is right and it is not the
model: `game/talk/prompts/greeting.md` puts `{{sky}}` in **one of three options
for every stance**, so about a third of all openings mention the weather because
the template hands it to them.

```
serve: What'll it be? | You're at the right counter. | I've been on this counter all day, and {{sky}}.
cook:  Mind the stove. | I've a pan on, so make it quick. | Kitchen's hot, and {{sky}}.
guard: State your business. | Nobody goes past me. | The post is mine, and {{sky}}.
```

Ten weather references in that one file, six more in `surroundings.md`.

It was a reasonable idea (a line that changes with the world so a greeting is not
fixed per person) and it is the wrong variable. The weather is the same for
everybody in the city at once, so using it as the varying part makes every
character sound like the same person. What should vary is what *they* are doing
and why they are there, which is the per-character context design above.

Fix: cut `{{sky}}` from the greeting beats and let the varying slot be their own
business. Keep weather available for the model to use when it matters (somebody
sheltering in a doorway in the rain has a reason to mention it) but stop seeding
it into a third of all first lines. Same for `surroundings.md`: check whether six
mentions is describing a room or padding it.

Box: `talk`.

### The chat window should close when you walk away (2026-08-23, found by him)

Walking out of range leaves the conversation panel open on nobody.

`@gb/crowd` publishes exactly the signal: a held walker is retired past
`retireRadius`, and `held === false` with no entry in `members()` is the tested
cue. `@gb/app` wired an `Attending.gone` port to `talking.end()` for street
walkers. So either that path is not firing, or it does not cover somebody
stationed indoors, which has no equivalent range rule.

Check indoors first: walking out of a shop mid-conversation is the likelier case
and the one with no publisher behind it.

Box: `app`, possibly `crowd` if an interior needs its own range rule.

### Somebody spoken to should come out of their stance (2026-08-23, found by him)

"when they are in the position over the table, and i speak to them they should
stand normal and look at me, not like staging there like marionettes."

Today a stationed person keeps playing their anchor clip and only the head turns
(`Member.lookAt`), so a worker bent over a desk stays bent over the desk with
their face rotated at you. The head-turn was built for walkers, where the body
also stops and turns; at an anchor nothing releases the stance.

What it needs: being spoken to is a **state**, not a look direction. Leave the
stance, come to a neutral standing or seated-attentive pose facing the player,
hold it for the conversation, and return to the stance when it ends.

The clips exist. `Sitting_Enter` and `Sitting_Exit` are in the free packs and
unused, which is exactly getting up and sitting down. `Idle_Loop` and the talking
gestures are already shipped, and the blend tool built today can make an
attentive variant from a stance plus a movement if a straight swap looks abrupt.

Two things to get right:

- **Where they stand.** Leaving a stance means leaving a measured position, and
  this project has spent a day getting bodies onto the right spot. Coming out of
  `work-desk` must not put somebody inside the desk, and going back must land
  where they were.
- **It interacts with the deferred turn already decided for street walkers.**
  A walker finishes crossing before facing you, on purpose. Indoors there is no
  such delay, so the two should not be made into one rule.

Boxes: `cast` for the pose change, `app` for driving it off the conversation
opening and closing, `forge` only if an anchor needs to publish where a body
stands when it steps away.

### Commerce, and people living in the places (2026-08-23, his design)

"remember they can follow, etc, and allow commerce/market, as well, buying things
from coffee shops and restaurants, allow npcs to sit, and eat as well, etc"

**Following is built** and should not be rebuilt: a companion walks a 203-cell
route with a worst gap of 3.43 m and no teleports, rides in a car, and comes back
beside the player on resume. What it lacks is reasons to use it, which the
per-character context work above supplies.

**Buying is not built at all.** Money exists as a quest reward and there is
nothing to spend it on, which makes the reward abstract. What it needs:

- A counter you can buy at, in the places that already have one. `serve` anchors,
  a `register` prop and a `shopFloor` room all exist; nothing sells.
- A price on a thing. `@gb/world`'s items have a name and an archetype and no
  value.
- What buying gets you. A coffee you carry and drink, a meal you sit down to, a
  keycard or a tool that opens a quest path (which connects to the hacking and
  access-card notes in his second wave).
- Somewhere for the money to matter, or credits stay a score.

**NPCs should sit and eat.** They sit already; `sit-drink` now raises a glass.
Eating does not exist in the free clip packs, and `Consume` (hand to mouth) is
paid-only, so this joins the purchase list as a sixth item. A restaurant full of
people at tables doing nothing but a seated idle is the current state, and it is
the room a player is most likely to walk into.

Ordering, because these depend on each other: buying needs a price and a counter
before it needs a UI, and eating needs a clip before it needs a menu. The cheap
first move is a price and one thing to buy; the expensive one is a market.

Boxes: `world` for value on an item, `forge` for who sells what, `app` and `hud`
for the exchange, `play` for what the money does, `cast` for the eating clip.

### A disco, as the first test of the charter design (2026-08-23, his idea)

"there are dancing animations, so you can put a nightclub where people go to
dance, or a disco whatever, a disco is more appropriate, and they can be dancing"

`Dance_Loop` is in the free Quaternius packs and unused, so the animation costs
nothing. `Celebration` is paid-only if more variety is wanted later.

**Build it through `docs/PLACES.md`, not as a building kind.** A disco named in
the enum is precisely the overfitting he rejected; a disco written as a charter
when the premise calls for one is the design working. So this is the best first
test case the charter system could have, because it exercises nearly every axis
at once:

- a `dance` stance, which is a **new anchor kind** and therefore a real question:
  anchor kinds are physical (a clip exists or it does not), so this one legitimately
  belongs in the closed vocabulary, unlike the place itself
- `finish` and lighting that are not corpo or home
- `access` that is `open` but with a room behind it that is not
- `holding` drink, `service` counter, `work` watch for a doorman
- a room use the current list does not have, so it tests how a new `ROOM_USE` is
  added

If the charter system cannot produce a disco with people dancing in it, the
design is wrong, and finding that out on something cheap and visible is worth
more than finding it out on a hospital.

Boxes: `world` for the `dance` anchor kind, `cast` for the shelf, `forge` and
`furnish` for the charter's room and dressing.

### Following does nothing: confirmed, and it is the indoors case (2026-08-23)

He picked the conversation move "ask them to come with you". The menu then
offered "ask them to stay here", so **the state flipped and no body moved.** That
rules out the naming confusion and confirms the known half-wired path:
`addCompanion` sets a flag and only the direct click path actually moves a body.

**The NPC also answered "Lead on."**, which narrows it further: the talk action
genuinely executed. It picked the move, spoke the line, flipped the menu, and by
today's rule that a carried-out move is a yes it also published an assent. So
everything up to and including the `did` event works. The break is strictly after
it: something receives `follow_player` and never puts a body on the road. Start
the search at the consumer of that event, not in `@gb/talk`.

**The sharper hypothesis, and the first thing to check:** the person was
stationed inside a building. Companions are handed over from `@gb/crowd`'s
walkers, and today's crowd pass made `follow` take the walker off the pavement
and reuse the very body they were wearing, passing `at: { x, z }` from
`walkers()`. That path assumes a walker exists. **A person standing at an anchor
indoors is not a walker**, so there is no body to convert and nothing to route.
Following would then work on the street and silently do nothing indoors, which
matches the report exactly.

What to check, in order:

1. Does the same move work on a passer-by in the street? If yes, it is the
   indoors case and the fix is a way to make a stationed person into a walker.
2. Is `Companions.toggle` reached at all from the talk action, or does the effect
   stop at the flag? One is a missing listener, the other is a missing body.
3. `@gb/crowd` needs to accept somebody who was never on the pavement: a spawn at
   the interior's doorstep rather than a hand-over from `walkers()`.

Separately, and worth doing anyway: the quests tab's `Follow` button means *track
this quest* and should be called `Track`. One word, two features, and the
collision is what made this ambiguous to report in the first place.

The companion machinery itself is sound and tested (203-cell route, worst gap
3.43 m, no teleports, rides in a car, resumes beside the player), so this is
getting a body into it, not the walking.

Boxes: `app` and `quest` for the effect, `crowd` for a companion who was never a
walker, `hud` for the name.

### A quest finished but nothing happened, and places are misnamed (2026-08-23)

Two from the same session.

**1. The quest completed and the mechanics did not reflect it.** This is very
likely the follow bug above, seen from the other end: `addCompanion` sets a flag,
the quest sees the flag and credits the step, and no body ever walked. An escort
completes while nobody escorted anything. It was predicted in an earlier
handover ("escort quests credit while nobody walks with you") and he has now hit
it.

That makes it a class, not one bug: **a step must credit on the thing happening,
not on the intent being recorded.** Worth auditing every step kind for the same
shape, because the harness cannot catch it — it drives the same events, so a
step credited off a flag looks identical to one credited off an act.

**2. Places are wrongly named.** Not yet reproduced or measured. Candidates, and
they need a screenshot to separate:

- the sign on the building says one thing and the interior is another kind of
  place
- the name a person uses in conversation is not the name over the door
- a name is generated for a plot and drawn on a different one

The third would be an id mismatch and the most serious. Note that facades stopped
going to the narrator today (a shut building's sign is composed locally from the
theme's vocabulary, which took 5,558 model calls down to 444), so if the sign and
the interior now disagree, that change is the first place to look.

Boxes: `quest` and `app` for the crediting, `forge` and `kitbash` for the names.

### The prompts need one pass end to end (2026-08-23, his read)

"there is a lot of prompt engineering it needs the whole gameplay end to end."

**Structural, and he is right.** Every prompt here was written by an agent scoped
to one box and judged against that box's own tests: the premise writer, the place
writer, the NPC brief, the greeting, the hook, the quest writer, the sign
vocabulary. Each is defensible alone. **Nobody has ever read the whole
player-facing output as one continuous experience.**

That is exactly what he did tonight, and it is why the seams are all he saw: the
weather in a third of greetings, narration mixed into speech, characters with no
reason to be anywhere, a quest hint written as if he were in the room, a
`complete` step carrying the payoff sentence nobody can read.

So this is not "improve the prompts", it is **one pass that reads the whole flow
in order** and fixes the joins: premise, city name, place names and signs, the
people in them and what they know, the greeting, a conversation, a quest as it
is offered, tracked, guided and paid. Judged by playing it, not by unit tests,
and by one person holding the whole thing rather than eight agents holding a
piece each.

Worth doing after the per-character context work, not before: half the flatness
he is reading as prompt quality is a character with no situation to talk about,
and rewriting wording around missing context would be tuning the wrong thing.

Also from the same message: **the map needs the quest icons** (main distinct from
side) and generally more information. Already in the interface entry above; he
has now asked twice, so it should not slip again.

### Place names all sound the same (2026-08-23, found by him)

"instance names are all too similar, the Lattern this the Lattern that, and names
are too confusing, we need better namings."

The cause is structural rather than a bad word list. Names come from
`game/forge/src/narrator/places.ts` `PATTERNS`, one template per building kind,
filled from the theme's word pool. A short pool plus a per-kind template gives
The Lantern Cup, The Lantern Rest, The Lantern anything, and a player reads them
as one name repeated.

Two things make it worse right now:

- **Facades stopped asking the model today.** That was a good change (5,558
  descriptive calls down to 444 at twenty blocks) but it means every shut
  building's sign now comes from the local composer, so the composer's
  repetitiveness went from occasional to citywide in one step.
- **The model repeats its own examples.** `@gb/scribe` observed the model
  reusing "The Copper Wheel" straight out of the house-style example in the
  system prompt. An example in a prompt comes back as output, so examples need
  to be obviously unusable or absent.

What would actually fix it, in order of value:

1. **No word may head two names in a town.** A uniqueness rule at composition
   time, held over the whole city rather than per plot. This alone removes the
   symptom he is describing.
2. **More than one shape of name.** Not only "The X Y": a family name
   (Endicott & Daughters), a trade plainly stated (Harbour Repairs), a number, a
   place, a person's first name. Real streets mix these and that mixture is most
   of what makes them read as real.
3. **Let the premise reach the names.** A town built on a collapsed freight trade
   should have names that sound like it. The premise is now in the world file and
   the composer does not read it.

**And he wants more than uniqueness:** "something REALLY special for each, not
like random jargon." That rules out fixing this by recombining a bigger word
list. A name that is special has to know something about the place.

**The cost objection is weaker than it looks, and I had it wrong.** The 5,558
facade calls were expensive because each was a **separate round trip**, not
because of tokens: a name is about five tokens, so naming every building in a
twenty-block city is on the order of 16k tokens of output. That fits in a handful
of batched calls. And batching is already proven here — the whole open-place set
now goes out in one call instead of one each, which is what took 376 s to 92 s.

So the shape is: **ask the model for the names, in batches, with the premise in
front of it**, rather than composing them locally. Give it the town's history,
the trade of each building and the street it stands on, and take back a list.
Keep the local composer as the offline path, where recombination is honest
because there is nothing better available.

Boxes: `forge` for the composer and the uniqueness rule, `scribe` for the batched
naming and the example leak.

### A settings menu (2026-08-23, his ask)

"in settings allow to lock time, put a setting button that has the exit game,
etc etc etc"

This is the container several logged items belong in, and it fixes the
discoverability class rather than one control at a time. Everything below already
works and is bound to an unlabelled key that appears nowhere:

| what | key today | found where |
|---|---|---|
| leave the game, open the panel | `N` | nowhere |
| hold the clock | `P` | nowhere |
| skip time forward | `T` | nowhere |
| change the weather | `K` | nowhere |
| the route guide | `G` | nowhere |

So a settings button on the bottom bar, beside QUESTS / MAP / ITEMS / CONTROLS,
holding at least: **lock time** (the clock hold, named as what it does rather
than as a key), the time and weather controls, and **exit game** leading to the
panel and its world library.

Two things worth deciding while building it:

- **Lock time is a real feature, not a debug key.** A player exploring a city
  they like should be able to keep it at night, which is also the hour the whole
  art direction was built for. Worth surfacing as a proper setting with the hour
  shown.
- **`CONTROLS` already exists on the bar and nothing on this list is in it.**
  Whatever the settings menu ends up holding, the controls tab should list every
  binding, and that is the cheap half that could land first.

Supersedes the earlier exit entry, which stands only for the world library part.

Boxes: `hud` for the menu and the bar, `app` for wiring exit and the clock.

### The creation form, in full (2026-08-23, his ask)

"creating a city we must put much more bigger form with all optional, can be
random or you can say, which kind of side quests you would like, style, and which
kind of main quest you would like, etc kind of theme or topic."

**Every field optional, random when left alone.** That is the load-bearing part:
the form can be long because a player who wants a city presses generate and gets
one. Nobody is made to fill it in.

Fields, and which are honourable today:

| field | goes to | reachable |
|---|---|---|
| what the city is about, in his words | the premise writer | yes |
| what the main quest should be about | the quest writer | yes, prompt work |
| what kind of side quests | the quest writer, which already has recipe weights | yes |
| tone or topic | premise and quest prompts | yes |
| size | already a parameter (`blocks`) | yes, exposed |
| seed | already a parameter | yes, and worth showing so a city can be shared by seed |
| **style** | the art catalogue | **partly, and be honest in the form** |

On style, and this needs saying in the interface rather than only here: the
catalogue is eight building looks, twelve facades, twelve outfits on one
skeleton. A player asking for medieval gets a cyberpunk town with medieval names.
What a style field *can* honestly offer is choices within the set: which facade
families dominate, how dense, how run down, how much neon. Offer those and do not
offer what cannot be drawn, because a form that silently ignores half its fields
is worse than a short one.

Two things to get right:

- **Random must be a real choice, not an empty string.** A blank field should
  produce a good city, which means the offline composer and the premise writer
  both need to handle absence well rather than degrade.
- **The form's answers belong in the world file.** A shared city should carry
  what it was asked for, the way it now carries its premise, or the person who
  opens it cannot see why it is the way it is, and `Forge.extend` cannot grow it
  in keeping.

This is the same job as the brief and the `theme` cap entries above; treat those
three as one piece of work.

Boxes: `app` for the panel, `forge` and `scribe` for consuming the fields,
`world` for carrying them.

### Running right now

`prefab` assigning twelve facade materials across eight looks and regenerating
the entrance door; `scribe` writing the model-backed premise; `cast` putting the
generated fabric on roughness; `forge` moving to world's `Premise` and
correcting a false contract claim; `app` building the headless seam; and a
twelve-agent design for open place kinds.


Everything known to be unfinished, by box. Delete a line when it is done.

## What to weigh work against

Flexibility and stability at scale come first. A change that makes the city
easier to regenerate, easier to grow, or safe at fifty blocks is worth more
than any single piece of surface detail. Polish a street lamp only when the
street it stands on is solid.

Concretely, in order:
1. Generating a new city, with new places and new quests, has to be easy and
   has to give a different place each time.
2. It has to hold together as the city gets bigger.
3. It has to export and reopen as the same world for somebody else.
4. Then the way it looks.

## Bugs on screen

| What | Box | Diagnosis |
|---|---|---|
| A white container frames the whole screen | unknown | Reported 2026-08-23. Not yet diagnosed. |
| Pavement lies on top of the road at junctions | `forge` | Junctions are painted after the bands, so 51 of 54 junction arm cells are pavement sitting on the roadway, 204 m2 in the small city and 1,524 m2 at 7x7. North-south streets only, because the row pass runs last. Cars also drive through a 15 cm kerb at every junction. This is PLAN task 3 and is the screenshot he keeps sending. |
| Street NPCs still do not talk | `app` | The crowd fixed its half: walkers carry real `Npc` ids now and `Crowd.person(id)` resolves them. The app needs one line to use it. |
| A car that touches you holds you in place | `app`, and `traffic` behind it | Once your centre is inside the car's rectangle every candidate position reads solid, so nothing can move you. Fixed in `walk.ts` by letting any step through that does not bury you deeper. The deeper fault is that a car should not drive onto you at all: `traffic` is given the player as an obstacle and still overlaps. |
| You can see under the pavement where it meets the verge | `scene` and `land` disagree | `scene` treats a `mountain` cell as 24 m tall when deciding kerbs, so it draws no kerb face there; `land` now lays that cell flat at ground level. About 172 cell-edges of 15 cm gap around the outer ring, and now on the road out of town too. |
| Cars drive out of town and vanish in plain sight | `traffic` | A car that runs out of graph is retired. The exit road now reaches the map edge, so it happens about 10 m past the last building. Traffic already defers retiring a stuck car until the player cannot see it; the same rule fits. |
| `nav` calls a mountain cell impassable, `land` calls it walkable verge | `nav` and `land` disagree | Does not block walking out, since the corridor is street and pavement the whole way, but the two boxes describe the same cells differently. |
| NPC clothing is medieval | `cast` | The only clothing we ship is Quaternius Modular Character Outfits **Fantasy**: Peasant and Ranger, two genders. |

## Next up

- **Two boxes hold the same prop sizes and they have drifted.** `@gb/forge`'s `PROP_SPECS` and `@gb/furnish`'s disagree. Worst is `table`: forge plans 1.6 x 0.9, furnish draws 1.0 x 1.0, so a chair approached along the table's width sits about 0.4 m off its edge. Also stove, fridge, sink, cabinet, bar-stool and sofa depth. Furnish's contract already claims its specs are "what `@gb/forge` places from", which is not true today. Forge cannot simply read furnish's, because that would put `three` in the headless generator's runtime. The likely answer is a small shared box holding cells, contact height and `onSurface` with no renderer dependency, which both read. This is the same "two boxes holding one number" fault that caused the floating arms and the low seats, so it is worth fixing properly rather than syncing the copies.
- **`@gb/forge` still serialises the narrator.** Peak concurrency 1 across a whole build, four of five llama slots idle, and the descriptive calls are 85% of model wall clock. `@gb/scribe`'s wave runner already fans out and will use the full width the moment forge issues `namePlace` and `describeNpc` / `describeItem` with `Promise.all`. Must reassemble by index, never by arrival, or determinism goes.

- **The vocabulary of places, for a cyberpunk city.** He named what he wants: "a hospital, a police station, an office, a corporate office, a nightclub". Today `BUILDING_KINDS` is house, apartment, bar, cafe, restaurant, shop, market, office, workshop, warehouse, clinic, hotel, station, chapel. Some of that is a market town rather than a city: a chapel is doubtful, a clinic wants to become a hospital, and there is no police station, no corporate tower and no nightclub. One coherent task across four boxes: the enum in `@gb/world`, the weights and staples and interior programmes in `@gb/forge`, a dresser per new kind in `@gb/furnish`, and a trade word for the sign in `@gb/kitbash`. A place is worth adding only if it changes what happens there, so each new kind needs its own rooms, its own staff role, and a reason a quest would send you.

- **A TV that plays something.** `tv` is already in the prop vocabulary and `@gb/furnish` already generates its geometry; what it lacks is a screen with moving pictures. Queued behind that box's wall and floor pass. Approach to weigh when it starts: a generated animated screen (a broadcast, a ticker, glitch, colour bars) costs no download, carries no licence question and suits a cyberpunk room, against a real video file which would have to be CC0 or ours and would sit in a world file that people hand to each other. A screen is also emissive, so it will bloom and light the room, which is worth more than the picture itself.

## Small, found by agents, nobody assigned

- `work-desk` is one anchor kind covering two stances: seated at an office chair, and standing at a workshop bench. `CLIP_FOR_ANCHOR` maps one clip per kind, so one of the two is playing the wrong animation today. Splitting it is an `ANCHOR_KINDS` value in `@gb/world` plus a clip in `@gb/cast`, and it breaks cast's exhaustive map, so it needs both boxes.
- A till and a coffee machine cannot stand on a counter: `Furniture` carries only a position and a rotation, so the planner could only put them on the floor, and it now omits them. Needs a lift field in `@gb/world` and `@gb/scene` drawing at the host prop's contact height.
- The bar counter is 1.100 while the rail clip's hands are at 1.02 to 1.04, so forearms pass through its front face. The 1.0 service counter is correct. Either the bar counter drops to 1.0 or it needs its own lean clip.

- `@gb/quest`: a `talk` step with a `topic` is only credited by a `talked` event carrying the same topic, but `objectives()` does not publish `topic`, so no caller can ever complete one. Publish it or drop the match. `forge` works around it by emitting no topics.
- `@gb/quest`: an `any-of` needs both branches reachable through `next` from the start AND pointing back at the any-of step. Neither the contract nor its two error messages say so; it cost an agent three attempts to find the shape.
- `@gb/nav`: `tests/contract.test.ts:125` does `plotsOfKind('bar')[0]!` on a generated town, so it assumes a building kind exists. Seeded staples nearly broke it; forge now keeps a bar in every town as a documented invariant, but the test should not lean on that.
- Quests never pay in items, because nothing removes a rewarded item from the shelf it lies on and paying in goods would duplicate it. Revisit when the app owns pickup.

## Traps found, worth knowing

- **`material.onBeforeCompile` does nothing under `WebGPURenderer`**, on either backend. It fails silently, so a material looks untouched rather than broken. Use `contextNode` with TSL instead. Only `furnish` had it; it is fixed.
- **The root `.gitignore` `build/` rule swallows any `src/build/` folder.** It had kept part of `kitbash` out of the repo entirely. Anchoring `/build/`, `/dist/` and `/target/` at the root is the general fix and nobody owns it yet.
- **New files written by an agent do not get committed** if it is told to stage explicit paths. Seventeen source files across cast, play and traffic were left untracked and a fresh clone could not build. Brief agents to run `git status --untracked-files=all` before finishing.
- **`THREE.Points` draws as single device pixels on a real WebGPU adapter.** r185 maps `Points` to `point-list` topology, which has no point size. Fine on the WebGL2 fallback this machine uses, so the stars are only at risk if we ever run on true WebGPU; the cure is `Points2` / `InstancedPointsNodeMaterial`.
- **A far plane does not buy depth precision.** Resolution at distance is `(d^2/n)(1 - n/f)/2^bits`; once far is much larger than near, moving far changes almost nothing. The near plane is the lever.
- **`@gb/kit`'s `Rng.int(min, max)` is half-open** and the contract does not say so. One word would save the next caller an off-by-one.

## Features asked for, not started

| What | Box | Note |
|---|---|---|
| Interior surfaces should carry metre UVs | `scene` | Ground meshes already do; interiors get 0-to-1 planes, which is why furnish needs a shader rule at all. `Dressing.surface(part)` passes no size. |
| Theme-appropriate props indoors | `furnish` | Fantasy Props MegaKit and Dungeon Pack are wrong for a modern city. |
| NPC daily routines | `crowd` | People go somewhere for a reason at a given hour. |
| Head turns to the player on click | `cast` | Asked for early; lip sync and gestures after. |
| Grow the city while playing | `app` + `scene` | `Forge.extend(world, count)` exists and is tested. Nothing consumes it. The scene cannot yet accept new plots without a rebuild. |
| Premise layer: why this town exists | new box | Offered, not approved. Buildings, people, quests and routines would follow from it. |

## Decisions taken this session

- The world is a **modern city**. Cars, streets and the Downtown City kit already suit it; clothing and interior props do not.
- **Buildings come from `glb-buildings`** (the user's own MIT toolkit) at world-creation time only, never at play time. 2.5 to 9 minutes of model time per building.
- **A capped library, not one building per plot.** Around 20 models chosen by role (corner block, mid-rise office, low retail, warehouse, tower, apartment slab), repeated across plots with rotation, mirroring, storey count and colour sheet for variation. SynthCity ships 15 and reads as a metropolis.
- **Per-draw cost is the budget, not draw count.** SynthCity holds thousands of draws because each is one mesh, one shared material, ~400 triangles. Our GLB buildings are 13 to 18 meshes and 11 to 15 materials each, which is the thing to fix. `join()` and `palette()` from gltf-transform collapse a building to one mesh and one material at build time; both are already installed.
- **Fog carries the horizon.** SynthCity's far plane is 1000 with fog eating the rest. Its aerial scale is out of reach for us and does not need to be matched.
- **No CC0 modern wardrobe exists on our rig.** 24 candidates checked, zero usable: every pack is either a different skeleton (62 joints against our 65, incompatible spine and finger topology), a fused mesh with clothing painted on, or not redistributable. The fallback is to cut the fantasy hardware off the four outfits we own and repaint the atlases.

## Decided, not built

- **AI buildings**: the full costed plan is in [PLAN-buildings.md](PLAN-buildings.md). Twelve looks authored offline, replayed into ~48 models, one packed `buildings.glb`, three fields per plot in the world file. Step zero is a five-minute measurement of material slots per building, because every draw-call figure rests on it.

## Blocked or waiting

- **Rust to Node switchover.** The Node service is proven: CORS passes, llama upstream answers correctly. The Rust binary is still the one bound to 8976. Once the user restarts on Node, delete `Cargo.toml`, `Cargo.lock`, `api/ llm/ stt/ tts/ models/`, `target/`, and update `game/sidecar/tests/contract.test.ts` and `docs/INDEX.md`.
- **Outfits pack version.** We vendor v2.0; v2.1 shipped 2026-07-05 and may carry 12 outfits on the free tier rather than 4. Re-run `fetch-assets` and count before doing any clothing work, because a front-opening longcoat would change the approach.

## The plan

[PLAN.md](PLAN.md) is the measured plan: what already works, why every seed
gives the same city, and thirteen box-scoped tasks in dependency order.

## A second wave he wrote down (2026-08-23)

Found as his own notes in the repo, captured verbatim into
`docs/REQUIREMENTS.md`. None of it is started. Grouped by the box that would
own it, roughly in the order a player would meet it:

- **Things you can use, not just carry** (`furnish` + `app`): real computers and
  terminals, in types — tablet, monitor, desktop, laptop — that both the player
  and NPCs can use. Security cameras.
- **Locks and ways past them** (`forge` + `quest` + `app`): hacking a machine,
  or typing a password the quest gave you. Doors with steel bars. Access cards
  for a specific place, an NPC's home included. The inventory carries access
  as well as objects.
- **The first agent has to plan for it** (`forge`): an instance brief says
  "a house with N people, an access door and a terminal", so the quest writer
  downstream can build a line on it. Locks nobody planned cannot be written into
  a quest.
- **Money and rewards that persist** (`play` + `quest`): credits as a reward,
  things to spend them on, and quests that unlock a car or an item you keep.
- **Fast travel** (`scene` + `app` + `hud`): a subway entrance you walk up to
  and click, the map opens, you pick a station and load in there.
- **A place of your own** (`forge` + `play`): a house instance for the player,
  things bought and put in it, and more houses to buy.

Weight: this is a second game layer on top of the one being finished, and most
of it needs the quest writer to know about locks and money before it can write
a line that uses them. The cheapest first step is the `forge` instance brief,
because everything else is unwritable until a generated place can contain a
locked thing.

## Packs: adding to a city after it is finished (2026-08-23)

> "city grow we do not want to grow it while we play, we do want to allow
> "DLC" so once we finish a city, we can add more things, but thats different
> from dynamically grow while you play"

Not live growth. A city is generated, played, and later added to as a separate
authored step; the result is a world file anyone can open, the same as the
original. `Forge.extend` is the mechanism and it is built and tested; what is
missing is everything around it.

What a pack has to guarantee, and none of it is guaranteed today:

- **The base city does not change.** Adding a pack must leave every existing
  street, building, interior, person and quest byte-identical. Anyone who played
  the original recognises it.
- **The design travels in the world file.** This is handover 21 and it is now
  the blocking one: the catalogue lives in code, so a city opened against a
  newer catalogue is re-skinned. A pack cannot be safe until a world file
  carries the design it was built with.
- **Ids continue rather than restart.** `world.toJSON()` carries `idCounters`;
  extend has to mint from where the base left off so a pack's people and things
  can never collide with the base's.
- **A pack's quests can use the base's places and people.** Otherwise a pack is
  a separate town rather than more of this one.
- **It is deterministic.** Same base plus same pack gives the same world on
  every machine, which is what makes a pack shareable at all.
- **Something applies it.** A command, and later a way in from the game.

Order: the design in the world file first, because a pack built before that is
a pack that can silently rewrite the city it is added to.

## More animation clips (2026-08-23)

He noticed the animation packs carry far more than we pull from them, and he is
right: people sitting in a bar could be drinking coffee, talking, doing
different idles, and today they are not.

**The machinery is already finished.** `clipForAnchor(kind, npcId)` picks from a
shelf of clips per anchor kind, hashed off the person's id, so the same person
always does the same thing and a city stays identical between openings. Adding a
clip is a name in `CLIPS_FOR_ANCHOR` plus the build tool pulling it. No code
design, no new seam.

**What we ship today, and it is thin.** Eight of the eleven anchor kinds have
exactly one clip:

| anchor | clips today |
|---|---|
| stand | 3 (idle, folded arms, on the phone) |
| lean | 3 (wall, wall crossed, wall smoking) |
| browse | 2 |
| sit, sit-drink, serve, cook, work-desk, work-bench, sleep, guard | **1 each** |

And three of the singles are the wrong clip rather than a thin one:

- **`sleep` plays a seated idle.** Somebody in bed is sitting up.
- **`sit-drink` has no drinking in it.** It is the same seated idle as `sit`.
- **`cook` is a plain standing idle.** Nothing about a stove.

Gestures are two clips, both talking, so the only thing anyone ever does over
their base pose is talk.

**Where the clips come from.** The rig is Quaternius Universal Base Characters,
65 joints, Unreal naming (`pelvis`, `spine_01`, `clavicle_l`, `calf_l`). Any
Quaternius Universal Animation Library pack binds with no retargeting, and
`tools/check-rig.mjs` is the gate: same joints, same order, or the file is
refused. Mixamo needs retargeting and is not the cheap path.

**Cost.** `anims.glb` is 0.62 MB for every clip in the game, no meshes, loaded
once and shared by everyone. It is a fixed catalogue like the textures, so more
clips are bytes paid once and never per world.

Worth doing as one pass: fix the three wrong ones, then widen the singles, then
add gestures worth layering (drinking, checking a phone, gesturing at something).
