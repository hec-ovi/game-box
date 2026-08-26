# Pending

What is open, checked against the code rather than against a report. Ordered by
what a player notices. Anything that got done has been taken out: this file is
the current state, not a log.

## Waiting on him at the keyboard

1. **A frame freezes for seconds at a time, at random.** His words: "all almost
   freeze and goes super slow cant move etc for some seconds, might be time
   change but i am not sure". Not reproduced yet and not guessed at. What is
   ruled out: generation (a 6 by 6 city builds offline in 189 ms) and `follow`
   (0.033 ms a frame on a 20 by 20 city, headless). `@gb/app` now times the
   frame loop in segments and writes one line for any frame over 120 ms
   (`src/stall.ts`), so the next time it happens the console names the layer.
   It cannot be caught here: this machine's Chrome returns null from
   `navigator.gpu.requestAdapter()`, so the game falls back to software and
   tells you nothing.

## Content: the city is thinner than it looks

2. **A city of 2,781 buildings opens 11 doors and holds 78 people.** Measured
   across sizes: 2 blocks gives 26 plots / 3 interiors / 18 people, 12 blocks
   1,089 / 6 / 46, 20 blocks 2,781 / 11 / 78. It is not a bug, it is
   `openPlacesFor` in `game/forge/src/interior/budget.ts` scaling 3 to
   `MOST_PLACES` (24) with the city's width. A town that size wants more to walk
   into. Raising it costs a model call per interior, which is the reason the cap
   is there; the answer is to raise it and make the build cheaper per place, not
   to leave it at 11. Box: `forge`.
3. **Nobody ever says a rumour.** `Charter.rumours` is filled on every kind of
   place and read by exactly one file, which renders it into a prompt.
   `@gb/talk`, `@gb/hud` and `@gb/app` never read one, so "what people say about
   such places" is never said by anybody. Boxes: `world`, `scribe`, `talk`.
   (`docs/HANDOVERS.md` row 305.)
4. **`Instance.character` is written and reaches nothing.** The model is asked
   what a building is, at a 20 character floor, and the answer dies with the
   process: no field on `@gb/world`'s interior, so it is not in the world file,
   not in the codex and never on screen. Either give it a home or stop asking.
   (Row 304.)

## The pipeline

5. **A build cannot be planned without being run.** `planStreets`, `planRaise`,
   `instanceRequests` and `signRequests` are private inside `Forge.build`, so
   there is no way to ask "what would this brief give" without building the
   whole city. That is why the creation form can say the grid, the doors and the
   height ceiling and nothing else: buildings, people and quest steps are only
   knowable after the fact. One `Forge.plan(brief, history)` would fix it.
   (Row 306.)
6. **A world file cannot give back the input it was written from.** It does not
   carry `blocksX`, `blocksY`, `blockCells`, `density`, `maxStoreys` or
   `openPlaces`, so a shared city cannot be rebuilt on its own terms and a pack
   that rewrites one place has to re-run the whole build to recover the
   question. Boxes: `forge`, `world`, `bundle`. (Row 307.)
7. **A refresh with the model on wipes the playthrough.** Reproducibility cannot
   be bought back: OpenRouter gave three different cities from one seed at
   temperature 0, and llama-server defaults to a fresh seed. So `Bundle.resume`
   has to tolerate a regenerated city rather than clearing the save. Box:
   `bundle`.
8. **Tool calls through OpenRouter are unproven.** A forced call came back with
   `content: null` and no `tool_calls`. Every generated thing in the project is
   a forced tool call, so nothing generates through the hosted path until this
   is settled. Likely candidates: needing `stream: true`, the call arriving in a
   reasoning field, or a shape difference from llama-server. The local path
   works and is what the game runs on.

## Look

9. **The plot shape band is written down twice.** `FRONTS` / `DEPTHS` live in
   `game/prefab/src/bucket.ts`, but how wide a plot is cut is a fact about the
   generator, not about the art. Until it moves, a generator that cuts outside
   the band is a coverage coincidence rather than a named bug.
10. **Two fifths of the street face is the producer's plain finish.** On the
    three looks that show the most wall, 42 to 44 percent of what a player sees
    is one flat base finish, identical across all four families. Giving each
    look's base the same picture as its facade is four layers and beats any
    remaining variant choice. Box: `prefab`.
11. **Minigames, and a score that survives.** Two games on a machine screen
    exist; nothing else does.
12. **Lip sync.**

## His own list, still open

13. **Zone click to fastest reach.** The map reports a district click
    (`district` intent); nothing routes to it yet. Box: `app`.
14. **The map is a window, not the screen.** He asked for it full screen with
    the 3D suspended. The frame is held while a window is open; the window is
    still a panel.
15. **The inventory's 3D item.** He asked to see and rotate the thing itself in
    the left panel. The panel is there; the model in it is not.
16. **Codex people and items as their own faces.** The conversation panel draws
    a real face now (`app/src/portraits.ts`); the codex still draws none.
17. **Voice.** He has it solved in another project and wants it here.
