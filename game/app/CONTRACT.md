# @gb/app contract

contractVersion: 0.9.0

## Purpose

The game you can play: the panel you make a city in, the renderer, the frame loop, the first-person body, the car it gets into, the grade that turns the hour into a look, and the wiring that turns every other box into a city you walk around.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| the panel | theme, seed, blocks across and down, whether the local model writes it | on screen with the first byte of the page; `blocks` is held between 1 and 12 |
| a city file | a `.gbworld.json` picked off the player's own machine | the file Export wrote, opened with nothing done to it in between |
| URL query | `?bundle=` a world file, or `?seed=`, `?theme=`, `?blocks=`, `?model`, `?sidecar=` | with none of them the panel waits rather than building anything. Everything the brief does not own is written back untouched, so a refresh keeps the sidecar and the file it was pointed at |
| `Boot.start(query)` | a `URLSearchParams` | the page holds `#game` and `#boot` |
| `Game.start(mount, bundle, options)` | an opened `@gb/bundle`, `GameOptions` | the bundle opened, so its world and quests are sound |
| `GameOptions` | `{ dressing, room?, cast?, kit?, cars?, sidecar?, save? }` | `save` is where the playthrough is kept between visits; `room` dresses one interior at a time, so a shop is not the flat above it |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| the running game | | walk, look, go into buildings, talk, take, carry, deliver |
| the controls | | mouse looks, WASD walks and drives, shift runs, C held crouches, space jumps, E acts on what is in reach (a door, a person, a thing to pick up, a surface a job wants it left on, a car), left click on somebody asks them along, right button held looks closer, G says the way to the tracked quest, T turns the time of day, K the weather, P holds the clock, N opens the panel, Escape leaves a conversation |
| a generated city | a sealed `@gb/bundle` document | byte for byte what the same brief builds anywhere else |
| Export | a `.gbworld.json` file | the document the game is playing, so what is kept is what was played |
| `Game.tick(seconds)` | | advances and draws one frame by hand, for when the browser suspends the loop |
| `Game.look()` | plain record | where the player is and what they could act on, for the console |
| `Game.keep()` | | writes the playthrough down now |

## Errors (closed set)

None at the boundary. A city that will not build and a file that will not open are sentences on the panel, not throws: the player reads what went wrong and tries something else. A missing asset pack is a duller city, not a blank screen.

## Dependencies

`@gb/bundle`, `@gb/cast`, `@gb/crowd`, `@gb/drive`, `@gb/forge`, `@gb/furnish`, `@gb/hud`, `@gb/kitbash`, `@gb/land`, `@gb/nav`, `@gb/play`, `@gb/quest`, `@gb/scene`, `@gb/scribe`, `@gb/sidecar`, `@gb/talk`, `@gb/traffic`, `@gb/world`, `three`.

## Invariants

- This box holds no rules. Quests advance in `@gb/quest`, inventory changes in `@gb/play`, conversations happen in `@gb/talk`, geometry is built in `@gb/scene`, a city is written in `@gb/forge`. Everything here is wiring, input and frames.
- The panel is served in `index.html`, so it is on screen with the first byte of the page rather than after the renderer, the art and the city have loaded. It says what is happening at every step of that wait, and offers a way to stop it.
- **A city somebody sent is opened by choosing the file.** The panel takes the `.gbworld.json` Export wrote, with no conversion and nothing to edit in an address bar, and a file that is not a city is a sentence on the panel rather than a throw.
- **The keys belong to whatever is taking what the player types.** The game binds on the document, so a conversation, the panel while it holds the keys, and any text box anywhere on the page are all asked first: naming a city cannot turn the hour over twice on its way in, and a space in a text box is not swallowed as a jump.
- **The panel is in front of everything, so the interface gets out of its way.** Handing the keys over shuts whatever window the hud had open, because a window left standing behind the panel takes Escape and Tab while the player is pressing them at the panel.
- The same theme, seed and block count give the same city, in the browser and out of it. Nothing here adds a number of its own to a brief: the block size and the roads out come from the seed, in `@gb/forge`.
- A brief is held inside what the generator will take before it is sent, so a block count nobody could build is trimmed rather than refused, and what remains that the generator still turns down comes back as a sentence.
- One city is being made at a time. Asking for another stops the one in flight, and so does Cancel: a generation runs against one `AbortSignal`, which `@gb/scribe` carries down to the model. A conversation is stopped by walking away from it, which breaks out of the reply stream and releases the call.
- Export writes the document the game opened, not a fresh pack of the same world, so the file and the playthrough cannot disagree.
- A refresh comes back to the same city and the same playthrough. The city is remembered as its brief and generated again; the playthrough is a `@gb/bundle` save in the browser's own store, and one that belongs to another city is dropped rather than forced.
- **A refresh comes back to the same spot, not the same city.** The city is built the same way every time, so what a save has to say over the top of it is put back last: the room the player was behind the door of is opened before their metres are read, because a room is measured in its own metres from its own corner; whoever was walking with them sets off from beside them rather than from the post the city just put them back on; and the job they were following is followed again, unless it is one nobody is holding any more, which is let go rather than pointing the map at it.
- **A playthrough never comes back with the clock frozen.** `P` pauses by setting the rate to zero, and that is what a save written afterwards carries. Coming back to a city where time never moves, the sun never sets and nothing says why is worse than losing a pause nobody asked to keep.
- One unit is one metre. Inside the built area the walls come from the grid the city was generated on; past it the land says how high the ground is and whether it can be stood on, so the player walks out of town onto open country rather than into the edge of the map. No physics engine, no baked collision.
- The player is placed on the pavement a step off the first door in town that opens, looking at it. Most buildings are shut, so the first door on the street is usually one nobody can go through, and a player who opens their eyes on a blank wall has nothing to press. The step is taken back off the kerb where the pavement is deep enough and along it where it is not, so the opening frame is a street rather than a facade. Entering a building puts them inside it facing the room.
- **The way in is only ever offered for a building that opens.** Seven in eight have no interior, and a prompt on one of those is a lie the player walks into.
- Looking closer narrows the field of view and slows the mouse by the same amount, so the same hand movement covers the same distance on screen however far in you are.
- The floor has height: the pavement stands a kerb above the road, and walking onto it steps up rather than clipping through. Crouching and standing ease between heights for the same reason.
- **How many cars a town carries is counted in lanes, not in towns.** One flat number was tuned when every road was one lane each way; an avenue carries four and the road out four, so the same total spread over twice the tarmac left the wide roads empty. It is one car per 110 metres of lane, read off `@gb/traffic`'s own lane graph, which is what the flat number came to on the size of town it was judged on: that town is unchanged and a bigger one gets cars in proportion to the road it has.
- Boxes that must not know about each other are joined here and only here: the crowd is told what is driving, traffic is told who is walking, both are told the hour so headlamps and lit windows agree with the sky, and none of them imports another.
- **The people on the street are the city's own residents, and only some of them.** Anybody the player passes can be named and talked to. Nobody is the last person out of a room, so every building that opens still has somebody standing in it, and at most a third of the town is out at once, so a bar keeps its regulars rather than its bartender alone. Who is out is read off the roster in the city's own order, so the same town sends the same people out every time and somebody found at their post is there on the next visit. Anybody the city stationed nowhere is always out, because there is nowhere to look for them.
- **Somebody who is out walking is not also standing behind their own counter, and the crosshair knows it.** One answer says who is standing in the room, and it settles all three things at once: whose body is drawn, who the prompt may offer, and who the player cannot walk through. That matters because the prompt is scored on how square something is to the aim over how far away it is, so anybody counted as present takes the prompt off whatever is on the counter beside them. Who is out is read once on the way through the door, because the street stops while the player is inside.
- **What the speaker did is the line for the turn in front of the player.** It goes into the conversation panel with their name on it, and every turn opens by taking the last one's line off, so "gave you a job" is never left standing under the next reply where it reads as a second job.
- **A conversation opens with them already talking.** `@gb/talk` builds the first line and the first menu off the game's own data with no model call, and both go up with the panel, so the player never reads an empty box while a model thinks.
- **A conversation can be held by clicking as well as by typing.** `@gb/talk` says which moves are legal this turn, and they go to `@gb/hud` as a menu in plain words. A click comes back as that move's own key and goes straight to the conversation, which carries it out with no model call; typing goes the way it always did. Walking away is left off the menu, because the panel already ends a conversation two ways the player can see. Every turn ends by publishing the menu again, even an empty one, which is what tells the interface its buttons are live.
- **Whoever is being talked to turns to the player and looks them in the eye**, and goes back to what they were doing when the conversation ends. A pedestrian stops mid-route, comes round, and walks the rest of their route afterwards; a companion stops keeping up and catches up again; somebody at their post in a room stays on their post and turns only as far as their head cannot reach, so a shopkeeper never swings their back to their own counter. The turn eases rather than snapping, and the head leads it. It happens on the conversation opening, not on being looked at: a pedestrian who stopped every time the crosshair crossed them would bring the pavement to a halt.
- A companion who followed the player into a building is waiting by the door when they come out, rather than where they were standing when the door closed.
- **A thing is put down where a job asked for it, and it is standing there afterwards.** A `stash` step names the room and the surface, and the room was built with a spot standing at that surface, so leaving something is walking up to it and pressing the same key that picks things up. `@gb/scene` draws it on that surface with the rule it built the room's own things with, so it can be seen where it was left and picked back up. The spot is only offered while the job is asking and the thing is in the player's hands, and it is worked out again at the moment the key goes down, so a prompt that has gone stale does nothing rather than something else.
- **A room is dressed as this playthrough left it, not as the city file wrote it.** The file says where everything started and `@gb/scene` builds every room from it, so a thing in the player's pocket would be drawn on its shelf as well and a thing they left on a strongbox would be back where it came from. Both are one thing twice, and either copy could be picked up. What the player is carrying is taken off the shelf, and what they moved is drawn where they moved it, once, when the room is built.
- **Whoever is speaking talks with their hands, on the pavement as well as behind a counter.** While a reply is arriving `@gb/cast` lays a talk gesture over the upper body of whoever is saying it, seated or standing to match the pose they are already holding, and takes it off when the line ends. It is a layer, not a clip: somebody leaning on their counter is still leaning on it. `@gb/crowd` and `@gb/cast` answer the same question in the same shape, so there is one lookup: the street first, because somebody out walking is not also standing behind their own counter. It is asked again every time and never kept, because a retired walker's body is handed to the next person out and a member held from one turn to the next is a stranger's arms.
- **Somebody who walks out of range ends the conversation.** A hold does not pin a walker on the pavement forever: `@gb/crowd` retires one the player has left far behind, hold and all, so walking away with the panel still open ends the person and not only the hold. The panel closes rather than staying open on nobody.
- **Somebody asked along sets off from where they are standing.** Their own spot on the pavement, read off the crowd, not the player's: handed the player's, whoever they called to across the street appears beside them instead of walking over.
- **The player can drive.** Any car on the road can be taken: `E` on a car within reach gets in, and `E` behind the wheel gets out. The companions ride, and are back on the pavement beside the car when the player gets out. While driving, the first person body is ridden rather than walked: the eye is put where the seat is every frame and the view turns with the car, so the mouse still looks around inside one that is cornering.
- **The car the player left is solid to walk into and something the traffic brakes for**, joined here the same way the crowd and the traffic are: `@gb/drive` and `@gb/traffic` never see each other.
- The player is stopped by people and by cars, not only by walls. Both move every frame, so what is solid is asked fresh rather than baked, and a car is treated as the long thing it is rather than as a circle.
- **The inside of a building is dressed for that building.** Each interior draws its own floor, walls and ceiling from `@gb/furnish` and is handed the run of wall bays that goes with them, added to the shell `@gb/scene` built. The people are dressed outside the furniture in the chain, so the room is that interior's and whoever is standing in it is still the cast's. Without the interior pack a room still builds, flatter.
- The landscape brings its own sky and light. Plain daylight only comes out if the landscape fails to build, so a scene is never unlit.
- The sky lights the scene once. A prefiltered copy of the skydome in `scene.environment` is the sky doing that job, so `Land.skyLight` is taken down rather than counted alongside it: with both on, a cast shadow takes 1.4% of the light off what it falls on instead of 39%, which is no shadow at all.
- **The sky is given the clock, not the reading off it.** `clock.hour` and `clock.minute` are whole numbers, so an hour built from them only moves once a game minute, which at the default rate is four times a second: the sun would hop 0.338 degrees a kick, two thirds of its own width, and the gradient, the fog and the stars with it. `clock.secondsOfDay / 3600` takes the step to 0.0225 degrees.
- **The reflection is moved between rebuilds rather than remade.** Prefiltering the sky costs about 20 ms against a 2.5 ms frame, so it can only happen when the hour turns. Left alone in between it falls an hour behind the dome and catches up in one frame, which at 06:00 is the environment's sun tripling between two frames. `scene.environmentRotation` follows the sun round and `scene.environmentIntensity` follows the sky's own brightness, both for nothing, because the sky's pattern is very nearly rigid about the vertical; the rebuild is then a correction rather than a step. The dome is put back at the origin for the prefilter, because it rides on the player and the camera that filters it does not.
- The landscape is built for the hour the playthrough is at. The environment is prefiltered off its skydome before the first frame, so a city opened at midnight and built at the landscape's own default midday would stand under a black sky lit like noon until the hour turned.
- Nothing reaches the screen unfiltered. The scene renders into a half float target and stays in linear light through the glow and the colour, and the tone map is the last thing that happens, so a halo rolls off instead of clipping to a flat disc.
- The frame is developed for the hour, and night is the hour the city is built for. After dark the sun is gone and the environment with it, so emissive is the whole lighting budget: a sign that does not bleed into the air around it is a coloured rectangle. The exposure comes down to hold the dark, the glow comes on, and the shadows go cold so a saturated hue has something to be saturated against.
- What makes neon read is the step from the sign to the dark beside it, not the size of the glow. The threshold is low so every sign is over it and the halo is tight so none of them swallows its own letters. A wide halo at a high strength reads as fog on the lens.
- The glow is taken off the finished frame, not off an emissive-only pass. What is bright is what glows, so a sign glows, and so does the sign again where a wet road is mirroring it.
- Indoors the hour stops driving the frame. A room is lit by its own ceiling at every hour of the day and is developed the same way whatever the sky outside is doing.
- The grade is a function of the hour and nothing else: no `Rng`, no wall clock, so the same minute of the same playthrough is the same frame on any machine.
- **The map is the grid the city was generated on**, handed to `@gb/hud` in cells: the plots as rectangles, the player as an arrow at their own bearing, and a pin on every place the tracked quest points at. Nothing is surveyed and nothing is baked, and it is measured only while the map is the face on screen, four times a second, so a window nobody has open costs nothing.
- **A step that names only a thing is still somewhere to go.** A place beats a person and a person beats a thing, so a delivery pins the stop rather than the parcel; a step to go and fetch something is pinned on the door of the building the thing is lying in, thing to room to building, because a shelf is inside a room and a room is measured in its own metres from its own corner. Any of an interchangeable pool answers, so three of the five crates is one pin.
- **Indoors, the map and the route measure from the door the player came in by**, for the same reason: a room has its own metres from its own corner, and they are not the city's.
- **The quest being followed is one that is still running.** A job that has been handed in is not what the map pins or the guide walks to: the pins fall back to the first quest with an open step, the same way the objectives panel does, so the panel and the plan never disagree.
- **Only the places the quest points at are named on the plan.** Nine hundred labels on one map is not a map.
- **The way somewhere is the walk, not the line.** `G` asks `@gb/nav` for the route from where the player is standing, and answers with the distance along it and the compass point of its first stretch: "The Copper Wheel: 140 m, head north-east". The map is north up, so the two read together. Nowhere to walk to says so rather than pointing through a building, and a step that points at nobody and nowhere says that about the step rather than telling a player who is following a quest to go and find one.
- **The quests tab is the quest log's own journal page, pushed as it stands.** Nothing here decides what a journal says: the page carries where every step stands, what it wants and how far along it is, and a step the player has not been told about is not on it, because the engine leaves it off. Walking the progress by hand instead is what listed a secret from the moment the quest was taken.
- **Giving a job up costs one report.** `@gb/hud` asks a second time on its own before it says so, so nothing here confirms it again; the quest log takes the job off and the list goes back without it, because the interface removes nothing itself.
- **A fork in a job is answered by its own key.** The question and the roads out of it are the quest's words, drawn by the interface; what comes back is the key of the road the player took, handed straight to the quest log, and the page and the objectives go back out with it.
- **The hour and the weather are the player's to turn.** `T` walks the time of day round dawn, midday, sundown and midnight, `K` walks the weather round clear, overcast and rain, and `P` holds the clock and lets it run again at the rate it was running at. Every one of them is a call into `@gb/play`, which owns what a reading means, and the sky follows because it reads the same clock every frame. Time only ever goes forward: a jump that wraps past midnight is tomorrow, so skipping to dawn runs a quest's timer down rather than winding it back.
- The interface is not in the chain. `@gb/hud` is DOM over the canvas, so the glow and the tint stop at the canvas edge and a panel is never bloomed.
- Half a game never sits on the page. A city that will not draw takes its stage and its interface back off before the panel says so, and the city itself can still be exported.
- The look belongs to `@gb/hud`. The panel is the one surface this box draws, because it has to be up before the hud exists; it is written from the hud's own tokens and holds no colour of its own.

## What the chain costs

Measured in Chrome on this machine's WebGL2 fallback (no WebGPU), at 1920 by 1080 with a device pixel ratio of 1, standing on the pavement at 22:00 in a three block neon town. The scene pass was timed straight to the screen and then through the chain, alternately, over four runs.

| | render passes | draw calls | frame |
|---|---|---|---|
| scene straight to the screen | 2 | 92 | 2.7 to 3.4 ms |
| scene through the chain | 14 | 104 | 3.0 to 3.9 ms |

The chain is 0.25 to 0.6 ms, median 0.4. It buys twelve more passes: the luminance high pass, five mip levels blurred once across and once down, and the composite. All the blurring is at half resolution, none of it carries geometry, and the colour grade is a handful of instructions riding in the composite, so it costs nothing measurable of its own. Multisampling moved with it, off the frame buffer and onto the scene pass, and that move is inside the same number.

It is a pixel bill, so it is the same at noon and at midnight whatever is on screen, and it is four times as much at a device pixel ratio of 2.

## The files

One responsibility each. `boot/` is everything before there is a game; the rest is the game.

| File | Holds |
|---|---|
| `boot/boot.ts` | the composition root: a brief in, a running game out |
| `boot/panel.ts` | the front door, driving the markup in `index.html` |
| `boot/brief.ts` | theme, seed and blocks: read from the address bar, trimmed to what builds, written back |
| `boot/city-maker.ts` | writing a city or opening a file, with progress and a way to stop |
| `boot/export.ts` | handing the sealed city to the browser as a file |
| `boot/kept.ts` | what the browser remembers: the last city, and its save |
| `boot/painted.ts` | waiting for the browser to draw a line before blocking it again |
| `focus.ts` | whether something else on the page is taking what the player types |
| `index.ts` | the box's one entry |
| `game.ts` | the pieces, and the frame |
| `controls.ts` | the keys the game binds, for the interface to print |
| `chart.ts` | the city from above, for the map face of the window |
| `places.ts` | what a quest objective points at, found on the city |
| `guide.ts` | the walk to it, and which way to set off |
| `conditions.ts` | the hour and the weather, and what a key does to them |
| `spawn.ts` | where the player opens their eyes |
| `session.ts` | the playthrough between visits |
| `playthrough.ts` | what a save says that the city file cannot: the player's place, who is with them, the job they follow |
| `renderer.ts` | renderer, camera, lights, the frame loop |
| `grade.ts` | the chain between the scene and the screen |
| `night.ts` | what an hour of the day is developed at |
| `tint.ts` | the night colour: cold shadows, saturated lights |
| `player.ts`, `walk.ts`, `stance.ts`, `zoom.ts` | the first-person body |
| `sky.ts` | the landscape and the hour it is lit for |
| `street.ts` | the crowd, the traffic and what each has to look out for |
| `buildings.ts` | going in and coming out |
| `targets.ts` | what can be acted on, and which one is in reach |
| `stashing.ts` | where a thing in hand can be left, and leaving it there |
| `interaction.ts` | what the player did with the keys and the mouse |
| `intents.ts` | what the player did in the interface, carried to whoever owns it |
| `talking.ts` | a conversation on screen: the reply, and the moves the player can click |
| `attending.ts` | whoever is being talked to, turned to face the player |
| `gestures.ts` | their hands, while they are the one speaking |
| `companions.ts` | who is walking with the player |
| `reporting.ts` | everything the hud is told |
| `solids.ts`, `bodies.ts` | what stops you: walls, floors, people, cars |
| `pack.ts`, `guarded.ts` | loading the art, and carrying on without it |

## How to modify this blackbox safely

Anything with a rule in it belongs in another box. Keep `walk.ts` free of three.js so the movement maths stays testable. The panel's look comes from `@gb/hud`'s tokens: if the hud publishes a shell for it, use that instead of the markup in `index.html`. Retuning how the city looks after dark is a change to the two records in `src/night.ts` alone; a new step in the chain goes in `src/grade.ts`, and the cost in this contract is remeasured with it. Run `pnpm --filter @gb/app test`, and `pnpm --filter @gb/app run dev` to look at it, which is the only way to judge a grade.
