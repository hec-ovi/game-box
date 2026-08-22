# @gb/app contract

contractVersion: 0.1.0

## Purpose

The game you can play: the renderer, the frame loop, the first-person body, and the wiring that turns every other box into a city you walk around.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `Game.start(mount, bundle, { dressing, cast?, sidecar? })` | an opened `@gb/bundle` | the bundle opened, so its world and quests are sound |
| URL query | `?bundle=` a world file, or `?seed=`, `?theme=`, `?blocks=`, `?model`, `?sidecar=` | with no bundle it generates one in the browser |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| the running game | | walk, look, go into buildings, talk, take, carry, deliver |
| the controls | | mouse looks, WASD walks, shift runs, C held crouches, space jumps, E acts on what is in reach, right button held looks closer, Escape leaves a conversation |
| `tick(seconds)` | | advances and draws one frame by hand, for when the browser suspends the loop |
| `look()` | plain record | where the player is and what they could act on, for the console |

## Errors (closed set)

None at the boundary: a missing asset pack is a duller city, not a blank screen, and a bundle that will not open throws before the game starts.

## Dependencies

`@gb/bundle`, `@gb/world`, `@gb/quest`, `@gb/play`, `@gb/scene`, `@gb/cast`, `@gb/talk`, `@gb/sidecar`, `@gb/forge`, `@gb/scribe`, `three`.

## Invariants

- This box holds no rules. Quests advance in `@gb/quest`, inventory changes in `@gb/play`, conversations happen in `@gb/talk`, geometry is built in `@gb/scene`. Everything here is wiring, input and frames.
- One unit is one metre, and the walls come from the same grid the city was generated on: no physics engine, no baked collision.
- The player is placed on the pavement facing the first door in town, and entering a building puts them inside it facing the room.
- Looking closer narrows the field of view and slows the mouse by the same amount, so the same hand movement covers the same distance on screen however far in you are.
- The floor has height: the pavement stands a kerb above the road, and walking onto it steps up rather than clipping through. Crouching and standing ease between heights for the same reason.
- The player is stopped by people and by cars, not only by walls. Both move every frame, so what is solid is asked fresh rather than baked, and a car is treated as the long thing it is rather than as a circle.
- The landscape brings its own sky and light. Plain daylight only comes out if the landscape fails to build, so a scene is never unlit.

## How to modify this blackbox safely

Anything with a rule in it belongs in another box. Keep `walk.ts` free of three.js so the movement maths stays testable. Run `pnpm --filter @gb/app test`, and `pnpm --filter @gb/app run dev` to look at it.
