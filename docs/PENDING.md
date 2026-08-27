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

## The pipeline

2. **A world file cannot give back the input it was written from.** It does not
   carry `blocksX`, `blocksY`, `blockCells`, `density`, `maxStoreys` or
   `openPlaces`, so a shared city cannot be rebuilt on its own terms and a pack
   that rewrites one place has to re-run the whole build to recover the
   question. Boxes: `forge`, `world`, `bundle`. (Row 307.)
3. **The hosted path calls tools; the free pool refuses more than it answers.**
   Measured 2026-08-27 with the owner's key: `google/gemma-4-31b-it:free`
   answered all four shapes (a named `tool_choice` and `required`, streamed and
   not) with a whole `name_city` call in about 2 s, including through the
   sidecar's own streamed parser, and not rebuilt from prose. What is left is
   capacity, not shape: every free model on the account spends long stretches
   answering HTTP 429 from a shared upstream pool, so a build through the
   hosted path stalls on waits. A paid key, or the account's privacy setting
   opened so paid models are reachable at all, is what fixes that. The sidecar
   can now point each of the five jobs at its own provider (`host/src/providers`),
   so the slow ones can sit on a machine of your own while the rest go hosted.

## Look

4. **A district's outline is derived twice.** `@gb/hud`'s map and the launcher's
   blueprint each turn a district's blocks into an outline: the cells it covers,
   the cell edges facing a cell it does not, the runs along one line joined, and
   the name at the middle of its largest block. The hud's `districtShape` is
   private and answers an `SVGGElement`, so a 3D view cannot take it;
   `game/app/src/boot/blueprint/zones.ts` carries the same derivation in grid
   coordinates answering line segments. Publishing the geometry from `@gb/hud`
   would leave one. It is also what the in-game map would need to become the
   blueprint. (`docs/HANDOVERS.md` row 316.)
5. **The plot shape band is written down twice.** `FRONTS` / `DEPTHS` live in
   `game/prefab/src/bucket.ts`, but how wide a plot is cut is a fact about the
   generator, not about the art. Until it moves, a generator that cuts outside
   the band is a coverage coincidence rather than a named bug.
6. **Two fifths of the street face is the producer's plain finish.** On the
   three looks that show the most wall, 42 to 44 percent of what a player sees
   is one flat base finish, identical across all four families. Giving each
   look's base the same picture as its facade is four layers and beats any
   remaining variant choice. Box: `prefab`.
7. **Minigames, and a score that survives.** Two games on a machine screen
   exist; nothing else does.

## His own list, still open

8. **Voice.** He has it solved in another project and wants it here.
