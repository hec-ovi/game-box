# @gb/app contract

contractVersion: 0.2.0

## Purpose

The game you can play: the panel you make a city in, the renderer, the frame loop, the first-person body, and the wiring that turns every other box into a city you walk around.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| the panel | theme, seed, blocks across and down, whether the local model writes it | on screen with the first byte of the page; `blocks` is held between 1 and 12 |
| URL query | `?bundle=` a world file, or `?seed=`, `?theme=`, `?blocks=`, `?model`, `?sidecar=` | with none of them the panel waits rather than building anything |
| `Boot.start(query)` | a `URLSearchParams` | the page holds `#game` and `#boot` |
| `Game.start(mount, bundle, options)` | an opened `@gb/bundle`, `GameOptions` | the bundle opened, so its world and quests are sound |
| `GameOptions` | `{ dressing, cast?, kit?, cars?, sidecar?, save? }` | `save` is where the playthrough is kept between visits |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| the running game | | walk, look, go into buildings, talk, take, carry, deliver |
| the controls | | mouse looks, WASD walks, shift runs, C held crouches, space jumps, E acts on what is in reach, left click on somebody asks them along, right button held looks closer, N opens the panel, Escape leaves a conversation |
| a generated city | a sealed `@gb/bundle` document | byte for byte what the same brief builds anywhere else |
| Export | a `.gbworld.json` file | the document the game is playing, so what is kept is what was played |
| `Game.tick(seconds)` | | advances and draws one frame by hand, for when the browser suspends the loop |
| `Game.look()` | plain record | where the player is and what they could act on, for the console |
| `Game.keep()` | | writes the playthrough down now |

## Errors (closed set)

None at the boundary. A city that will not build and a file that will not open are sentences on the panel, not throws: the player reads what went wrong and tries something else. A missing asset pack is a duller city, not a blank screen.

## Dependencies

`@gb/bundle`, `@gb/cast`, `@gb/crowd`, `@gb/forge`, `@gb/furnish`, `@gb/hud`, `@gb/kitbash`, `@gb/land`, `@gb/nav`, `@gb/play`, `@gb/quest`, `@gb/scene`, `@gb/scribe`, `@gb/sidecar`, `@gb/talk`, `@gb/traffic`, `@gb/world`, `three`.

## Invariants

- This box holds no rules. Quests advance in `@gb/quest`, inventory changes in `@gb/play`, conversations happen in `@gb/talk`, geometry is built in `@gb/scene`, a city is written in `@gb/forge`. Everything here is wiring, input and frames.
- The panel is served in `index.html`, so it is on screen with the first byte of the page rather than after the renderer, the art and the city have loaded. It says what is happening at every step of that wait, and offers a way to stop it.
- The same theme, seed and block count give the same city, in the browser and out of it. Nothing here adds a number of its own to a brief: the block size and the roads out come from the seed, in `@gb/forge`.
- A brief is held inside what the generator will take before it is sent, so a block count nobody could build is trimmed rather than refused, and what remains that the generator still turns down comes back as a sentence.
- One city is being made at a time. Asking for another stops the one in flight, and so does Cancel: a generation runs against one `AbortSignal`, which `@gb/scribe` carries down to the model. A conversation is stopped by walking away from it, which breaks out of the reply stream and releases the call.
- Export writes the document the game opened, not a fresh pack of the same world, so the file and the playthrough cannot disagree.
- A refresh comes back to the same city and the same playthrough. The city is remembered as its brief and generated again; the playthrough is a `@gb/bundle` save in the browser's own store, and one that belongs to another city is dropped rather than forced.
- One unit is one metre. Inside the built area the walls come from the grid the city was generated on; past it the land says how high the ground is and whether it can be stood on, so the player walks out of town onto open country rather than into the edge of the map. No physics engine, no baked collision.
- The player is placed on the pavement facing the first door in town, and entering a building puts them inside it facing the room.
- Looking closer narrows the field of view and slows the mouse by the same amount, so the same hand movement covers the same distance on screen however far in you are.
- The floor has height: the pavement stands a kerb above the road, and walking onto it steps up rather than clipping through. Crouching and standing ease between heights for the same reason.
- Boxes that must not know about each other are joined here and only here: the crowd is told what is driving, traffic is told who is walking, both are told the hour so headlamps and lit windows agree with the sky, and none of them imports another.
- The people on the street are the city's own residents, so anybody the player passes can be named and talked to, and somebody who is out walking is not also standing behind their own counter.
- A companion who followed the player into a building is waiting by the door when they come out, rather than where they were standing when the door closed.
- The player is stopped by people and by cars, not only by walls. Both move every frame, so what is solid is asked fresh rather than baked, and a car is treated as the long thing it is rather than as a circle.
- The landscape brings its own sky and light. Plain daylight only comes out if the landscape fails to build, so a scene is never unlit.
- The sky lights the scene once. A prefiltered copy of the skydome in `scene.environment` is the sky doing that job, so `Land.skyLight` is taken down rather than counted alongside it: with both on, a cast shadow takes 1.4% of the light off what it falls on instead of 39%, which is no shadow at all.
- Half a game never sits on the page. A city that will not draw takes its stage and its interface back off before the panel says so, and the city itself can still be exported.
- The look belongs to `@gb/hud`. The panel is the one surface this box draws, because it has to be up before the hud exists; it is written from the hud's own tokens and holds no colour of its own.

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
| `index.ts` | the box's one entry |
| `game.ts` | the pieces, and the frame |
| `controls.ts` | the keys the game binds, for the interface to print |
| `session.ts` | the playthrough between visits |
| `renderer.ts` | renderer, camera, lights, the frame loop |
| `player.ts`, `walk.ts`, `stance.ts`, `zoom.ts` | the first-person body |
| `sky.ts` | the landscape and the hour it is lit for |
| `street.ts` | the crowd, the traffic and what each has to look out for |
| `buildings.ts` | going in and coming out |
| `targets.ts` | what can be acted on, and which one is in reach |
| `interaction.ts` | what the player did and what it does |
| `talking.ts` | a conversation on screen |
| `companions.ts` | who is walking with the player |
| `reporting.ts` | everything the hud is told |
| `solids.ts`, `bodies.ts` | what stops you: walls, floors, people, cars |
| `pack.ts`, `guarded.ts` | loading the art, and carrying on without it |

## How to modify this blackbox safely

Anything with a rule in it belongs in another box. Keep `walk.ts` free of three.js so the movement maths stays testable. The panel's look comes from `@gb/hud`'s tokens: if the hud publishes a shell for it, use that instead of the markup in `index.html`. Run `pnpm --filter @gb/app test`, and `pnpm --filter @gb/app run dev` to look at it.
