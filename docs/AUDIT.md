<!-- Read-only audit, 2026-08-25. Every row is measured against the code, not against a contract. -->

# What is not done

Ranked by what a player runs into. Every row is what an auditor measured, not what a contract says.

---

## Blocks play

**1. The street is empty. A city of 3,136 buildings puts two pedestrians on the pavement.**
Boxes: crowd, talk, play, app.
Evidence: `game/app/src/street.ts:96-108` still draws the crowd from the city file's own residents and asks for 14 of them; the measured 20x20 city writes 5 npcs, of which 2 go out. No stranger template exists in `@gb/talk` (0 grep hits), and `@gb/play` keeps no stranger.
Previously claimed done: no. It was designed in `docs/CITY.md:96-111` and assigned, and nothing was built. The three-open-places change turned this from a nice-to-have into the reason the city looks abandoned.

---

## Visible to a player

**2. The Minimap button in Settings is drawn switched on and does nothing; the minimap itself never appears.**
Boxes: hud, app.
Evidence: hud builds and mounts the whole surface (`surfaces/minimap.ts`, mounted `hud.ts:78`) but it only reveals when the game pushes it a view; `grep -rn -i minimap game/app/src` returns nothing, and `intents.ts` has no `minimap` case, so the button also always reads pressed.
Previously claimed done: the surface landed today and the button shipped with it, so on screen it reads finished.

**3. Full screen does nothing. The Controls tab prints "F — Full screen, on and off"; the key and the button both fire into nothing.**
Boxes: hud, app.
Evidence: `keys.ts:31` binds `f`, `hud.ts:149-150` dispatches the intent, `tabs/settings.ts:39` has the button; `requestFullscreen` appears nowhere in the repo.
Previously claimed done: yes, in the controls list the player reads.

**4. Doing a town's jobs makes the town think less of you.**
Boxes: forge, quest, play.
Evidence: 11 of 12 quests in the shipped city pay negative standing to the faction that handed them out; quest_0005 requires `allied:plot_0109` and pays that same side −10. One line: `game/forge/src/quests/difficulty.ts:103` halves and negates the payout whenever the step allowed stealing, and 15 of 15 collect steps allow it. 220 of 488 quests across 42 cities pay negative.
Previously claimed done: yes — `game/forge/CONTRACT.md:163` says a job pays standing to the place it was for.

**5. Fast travel cannot be used in the city the launcher makes by default: it has one station, and a ride needs two.**
Boxes: forge, app, hud.
Evidence: the default brief builds "Half Crossing", 39 plots, 1 station; across 21 offline cities 2x2 and 3x3 gave 0 stations, and only 5 of 21 had the two a ride needs. The plan opens onto a list where the only entry is `Here`.
Previously claimed done: the app and hud path is complete and the prompt appears, so it presents as working.

**6. The only screen in the default city is locked with a password no quest ever hands out.**
Boxes: forge, app.
Evidence: seed `town`, 2 blocks: one machine, `locked: true, password: 'lantern-96'`, and the quest set contains no `hack` step and no `give-password` effect. Every screen that is not a game is locked by `game/forge/src/interior/machines.ts:33`.
Previously claimed done: yes — `game/app/CONTRACT.md` says a word a job handed out opens a screen on sight.

**7. Snake and tetris are not in most cities, and not in the default one, because a game only ever runs on a screen standing on a bar counter.**
Boxes: forge, hud, app.
Evidence: `game/forge/src/interior/machines.ts:39` is the only branch that returns a game. Over 30 offline cities, 17 had any game machine at all; the default city has zero. Both the hud and app sides are whole.
Previously claimed done: yes — listed as a general recipe in `game/forge/CONTRACT.md:164`.

**8. You are never asked to buy anything, though buying at a counter works.**
Boxes: forge.
Evidence: 0 `buy` steps across 349 quests in 35 cities, and 0 across 488 quests in 42 more. Asked directly, the shopping recipe writes a draft 204 times out of 300 — it just never wins a slot, being side-work-only in a mix the main line dominates.
Previously claimed done: yes — `game/forge/CONTRACT.md:164` lists the shopping list as one of thirteen recipes.

**9. No door in a generated city is ever locked, nobody is carrying a key, and no quest ever asks you to open anything.**
Boxes: forge, world, quest.
Evidence: all 14 shipped charters are `access: 'open'`, so a lock can only come from a charter the history declares, and the offline writer can declare exactly one (`disco`, neon themes only). Measured: 2 locked doors across 35 cities, 33 of them zero; 0 of 36 item placements are `at: 'npc'`; 2 `unlock` steps and 2 `access` rewards across 349 quests. The runtime on both sides is finished and correct, so this is a completed mechanic the generator never feeds.
Previously claimed done: yes, three times — `game/forge/CONTRACT.md:21,134,165`. The scribe contract even publishes a measured town with a locked door and a key in the doorman's pocket, which the offline default cannot produce.

**10. Nobody in the city has a home, and no building belongs to anybody.**
Boxes: forge, world.
Evidence: 0 interiors with an `owner` and 0 npcs with a `homePlotId` in the shipped city and across all 42 offline 5x5 cities. `game/forge/src/raise/homes.ts:22` sells every open home when the town has only one, and the owner path at `assemble.ts:100` only runs for a home that is not for sale, so below the size that opens a second home it is unreachable.
Previously claimed done: yes — `game/forge/CONTRACT.md:146` ("Every other home is somebody's").

**11. Buy a house, reload, and it is not yours.**
Boxes: app, bundle, world.
Evidence: `game/app/src/counters.ts:95` records the owner into the running world; every write back to the shelf in that box is in `boot/`, and `game.ts` never writes a document. `@gb/play` holds no ownership either, so nothing restores it.
Previously claimed done: no, it is an open handover — but the purchase itself works, so it reads as done in play.

**12. The bigger the city, the fewer people in it. A 1,224 m city ships 5.**
Boxes: forge.
Evidence: `--blocks 20x20` writes 5 npcs, `2x2` writes 7, `10x10` writes 14. The count is whatever the three interiors' anchors happen to roll (`populate.ts:47-71`), not a target.
Previously claimed done: `docs/CITY.md:18` says "about a dozen", which the largest city misses by more than half.

**13. The city has no neighbourhoods. Nothing is called "West Bay" or "downtown", on the map, in the guide or in the station list.**
Boxes: world, forge, scribe, hud.
Evidence: `game/world/src/model/premise.ts:19-33` has no districts and no places roster; `grep -c district game/world/schema/world.json` = 0; a plot carries id, kind, name, rect, storeys, entrance, style, design and nothing else.
Previously claimed done: no. Designed in `docs/CITY.md:36-60`, assigned to four boxes, unstarted.

**14. Standing in front of somebody who hands out work looks exactly like standing in front of anybody.**
Boxes: app, scene, hud.
Evidence: nothing in app, scene or hud draws a marker in the world; the only in-world pointer is the compass strip, which shows the one tracked quest.
Previously claimed done: no.

**15. A door you can walk through looks exactly like the doors that never open.**
Boxes: world, forge, prefab.
Evidence: `PlotSchema` (`game/world/src/model/schema.ts:126-142`) has no `opens` flag; the only `opens` in the schema is on an item. One flag was asked for and never added. With three open doors in a 3,000-building town, finding them is now the whole problem.
Previously claimed done: no.

**16. An unlocked gate of bars is still drawn shut.**
Boxes: app, furnish, cast.
Evidence: `@gb/furnish` publishes `opened(prop)`; app's `RoomArt` type has no `opened`, and `CastDressing` (`game/cast/src/dressing.ts:18-27`) forwards only lights, marking and clutter, so the answer dies at that link. `grep -rn opened game/app/src` finds no call.
Previously claimed done: recorded as "half closed" in the handovers, which overstates it.

**17. A station's subway stairs are paved over — only the balustrade shows.**
Boxes: scene, kitbash, world.
Evidence: `grep -rn "stations()" game/scene/src` returns nothing, so no ground quad, street skin or doorstep marking skips a station's entrance cell. `@gb/kitbash` draws the well underneath it.
Previously claimed done: no.

**18. Pedestrians walk through the station railings.**
Boxes: crowd, world, kitbash.
Evidence: `grep -rn "stations()" game/crowd/src` returns nothing; the doorstep cell is plain pavement to the router. This confirms a hypothesis that was filed unmeasured.
Previously claimed done: no.

**19. Buildings from the art pack (which is nearly all of them) get no subway entrance and no door camera; only kit-built ones do.**
Boxes: prefab, kitbash.
Evidence: `fixturesFor`/`fixtureParts` are exported by kitbash and called only inside kitbash and its own tests.
Previously claimed done: no.

**20. Nothing in the city is taller than the rest. There are no landmarks.**
Boxes: forge, prefab, world.
Evidence: `game/forge/src/layout/plots.ts:106-113` — the only height lift is +1 storey on an avenue, everything clamped to the band maximum. `charter.prominence` is read for the plot mix and never for height.
Previously claimed done: no.

**21. A pack cannot open a facade into a real place, cannot add blocks at the edge, and cannot add a quest.**
Boxes: bundle, cli, forge, app.
Evidence: `gb extend city.json --count 10` printed "10 buildings added, 0 of them open, 0 people, 0 things"; `gb pack base grown` printed "0 interiors, 0 people, 0 things, 0 quests". Extend only builds on land nothing has claimed and never converts a facade; `game/cli/src/extend.ts:32,51` passes the base's quests straight through, so a pack can carry no new one. With the door budget now fixed at 3 and the base spending it, a pack can no longer open anything at all.
Previously claimed done: no. Designed in `docs/CITY.md:114-125`.

**22. You cannot make the 50x50 city.**
Boxes: app, forge.
Evidence: the launcher's field is capped at 24 blocks (`boot/brief.ts:28`, `index.html:376`); from the CLI, `gb build --blocks 50x50` refuses ("needs a 1587-cell grid; a city is at most 1024 cells a side") and only builds at a forced small block size.
Previously claimed done: no.

**23. A quest can send you to a room behind a locked door with no key anywhere, and nothing checks.**
Boxes: forge, nav, play.
Evidence: `@gb/nav` publishes `reachableRoom`; it is imported nowhere outside nav and its tests, and forge does not depend on nav, so it cannot call it. Masked today only because cities have no locks (row 9).
Previously claimed done: no.

**24. Daylight is flat. Two faces of one building land at the same brightness and nothing casts a shadow.**
Boxes: app, land.
Evidence: on the owner's own frame, the two faces of one corner building differ by 14%, and pavement, roadway and sky all land within 3 luminance points. Cause measured: `game/app/src/sky.ts:136` sets `environmentIntensity` to a ratio that is always 1.0, and land's own contract measures that exact setting as "darkens by 1.4 percent, where it has stopped being visible at all". Every other wire (shadow map, `castShadow`, exposure) is present and correct.
Previously claimed done: yes, twice — `game/app/CONTRACT.md:115,120` — and already logged as a failed claim at `docs/CLAIMS.md:14`.

**25. There is a dotted line under every sign.**
Boxes: kitbash.
Evidence: an 8x crop of the owner's frame shows a binary per-pixel interleave of panel and wall along the intersection, with no blending. Cause: the letter quads sit `SIGN.layer` = 0.005 m off an otherwise coplanar panel (`sign/build.ts:25-26`), which is z-fighting. The working tree raises it to 0.01 m, uncommitted and never seen on screen.
Previously claimed done: yes — `game/kitbash/CONTRACT.md:96` says there is nothing to sort; also logged as a failed claim at `docs/CLAIMS.md:16`.

**26. A sign's glow at night swallows its own letters and floods the whole shopfront.**
Boxes: kitbash, app.
Evidence: 2.3% of the night frame is fully blown white on all three channels and 7.7% is above 200, from one sign. Two dials: `SIGN.glow` = 2 on top of emissive up to 1.25, and the night bloom at strength 0.6 / threshold 0.6. Which of the two is wrong is unproven.
Previously claimed done: yes — `game/app/src/night.ts:43-50` says the halo is tight so none swallows its letters.

**27. At night a wall with no lamp on it goes black; only the roofline tube and the lit windows read.**
Boxes: land, app.
Evidence: `game/app/src/sky.ts:50` hides the hemisphere light that carries the night ambient. Printed at midnight: skyLight 0.780 hidden, moon 0.340, dome 0.0188 — about a thirteenth of the night budget land publishes. This is also what the "building vanished, lights still there" frames look like once the point lights move off a facade.
Previously claimed done: yes — `game/land/CONTRACT.md:114` ("Night is dim, not black... about five times darker than noon").

**28. Indoors the room is lit by whatever the sky was doing when you walked in.**
Boxes: app, scene, land.
Evidence: `renderer.ts:84-101` toggles the room lights and the daylight group and never touches `scene.environment` or its intensity, and `sky.ts:103` returns early when not outdoors, so the value freezes at the last outdoor frame. The dome it was filtered from ranges 85:1 between noon and midnight.
Previously claimed done: yes — the comment at `game/app/src/night.ts:53-56` says a room is lit by its own ceiling at every hour.

**29. Three separate clocks decide what is lit and they disagree by up to 6x through dusk and dawn.**
Boxes: scene, kitbash, land, traffic, app.
Evidence: printed on the temperate theme (city night / kit level / headlamps): 17:30 gives 0.777 / 0.000 / 0.500 — the street's point lights burn at 78% while the sign geometry throwing them is completely unlit.
Previously claimed done: yes — `game/scene/CONTRACT.md:110` says it is "the same reading the buildings light their windows on".

---

## Invisible (real, nothing on screen shows it yet)

**30. Nothing anyone can click can open more than three places.**
Boxes: forge, app, cli.
Evidence: forge accepts `openPlaces` up to 24; `grep -rn openPlaces game/app game/cli` returns nothing and `index.html` has no field.
Previously claimed done: `docs/CITY.md:16` says "the creation form may raise it".

**31. Any art chain with the cast in front loses building level-of-detail, silently.**
Boxes: cast, scene.
Evidence: printed from the real classes — `Greybox: shell, lights, marking, clutter` but `CastDressing(cast, Greybox): lights, marking, clutter, members`. Scene decides LOD by the presence of `shell` alone, so such a city pays for the whole town at open. Only `game/app/src/pack.ts:85`, which lifts `shell` off the buildings layer by hand, hides it today — and the same missing forwarding is what kills `opened` in row 16.
Previously claimed done: yes — the docstring at `game/cast/src/dressing.ts:8-10` says optional parts are forwarded so nothing is lost on the way.

**32. The narrator describing a room is never told which piece a screen sits on, or that a locked door has bars across it.**
Boxes: forge, scribe.
Evidence: `game/forge/src/raise/plan.ts:107` emits machines as `{room, program}` and :106 emits locks as `{room, by}` — the two shapes that were asked to grow.

**33. The playability harness's lock rules have never once executed against a generated city.**
Boxes: forge.
Evidence: ran the real harness on the shipped city: `shut` is 0 in all three modes, because the file has 0 locked doors. The lock walk only runs against hand-written fixtures.
Previously claimed done: yes — `game/forge/CONTRACT.md:172` describes it as reading the world's locks, so the "N of N completable" figure says nothing about locks.

**34. A pack applied to a city loses its own art catalogues.**
Boxes: bundle, world.
Evidence: `game/bundle/src/pack/pack.ts:71` sets `requires: [...base.requires]`; the pack's own catalogues are never merged in.

**35. If the road graph is refused, you get a city with no roads and no complaint.**
Boxes: forge, world.
Evidence: `game/forge/src/layout/roads.ts:34` discards the `Result` that `world.addRoad` returns.

**36. Interior surfaces carry metre UVs now and furnish still runs its own world-space projection on top.**
Boxes: furnish, scene.
Evidence: `game/scene/src/shell.ts` applies metre UVs to floor, ceiling and walls; `game/furnish/src/surfaces/pattern.ts:47-48` still projects off `positionWorld` and `tiling.ts:54` still replaces the default UV.

**37. Two closed lists mean the same thing: `@gb/traffic` keeps its own car roster instead of citing the world's.**
Boxes: traffic, world.
Evidence: `game/traffic/src/settings.ts:9-10` and `game/world/src/model/cars.ts:6` hold the identical seven values.

**38. `dance-floor` is not a room use, so furnish reaches it by casting the union away.**
Boxes: world, furnish.
Evidence: `ROOM_USES` lists 23 uses and no dance-floor; `game/furnish/src/dance/room.ts:23` reads `(room.use as string)`.

**39. Forge anchors everybody against the customer side of a counter; the staff-side point published for it is read only by furnish.**
Boxes: forge, world, furnish.
Evidence: `grep -rn staffContact game/forge` returns nothing.

**40. The handover ledger is no longer an address. 36 row numbers are reused (three of them three times), 14 numbers were never issued, and the prose cites a row 113 that does not exist.**
Boxes: docs.
Evidence: counted directly in `docs/HANDOVERS.md`. Four rows in it are already closed by the code, and four more ask for a shape that has since been superseded, so following them would undo the current answer.

**41. Repo bookkeeping still describes things that are not true: `assets/registry/sources.json` says clips were retargeted from a pack that ships nothing, `downloaded.json` records three removed packs, `docs/PLAN.md:105` and `docs/PIPELINE.md:203-205` cite code that no longer exists, several `docs/PENDING.md` rows list bugs that are fixed, there is no `CHANGELOG.md`, and `package.json` still carries the pnpm setting that `pnpm-workspace.yaml` replaced.**
Boxes: repo, docs, assets.

---

## Cosmetic

**42. The Controls tab tells the player less than E actually does — no locked door, no screen at a desk, no subway entrance.**
Boxes: app, hud. Evidence: `game/app/src/controls.ts:15` lists five of the nine target kinds `interaction.ts:146-177` handles.

**43. Two contract sentences are now false and will mislead the next reader: `game/app/CONTRACT.md` still says seven doors in eight have no interior (it is 2,327 in 2,330), and `game/forge/CONTRACT.md:166` says no other line promises the deed (two branches of one fork both do, correctly).**
Boxes: app, forge.

**44. Every street runs the full width and height of the map: 121 four-way junctions in a 10x10 town, no dead ends, no T junctions.**
Boxes: forge. Evidence: `layout/streets.ts:33-36` paints each band over the full span; measured 11 column and 11 row centrelines, every one crossing the map.
Previously claimed done: no. Asked for in `docs/CITY.md:75-76`.

**45. There is no diagonal avenue.**
Boxes: forge. Evidence: `grep -ri staircase game/` finds nothing outside docs; a band is one straight rectangle with no per-row offset anywhere in the layout. Asked for in `docs/CITY.md:78-81`.

**46. No overhead wires between the street lamps.**
Boxes: kitbash. Evidence: `grep -rn -i wire game/kitbash/src` returns nothing.

**47. A password learned outside a quest opens nothing — there is no way to type one at a door.**
Boxes: hud, app, play. Evidence: the only password field in the hud is on a screen and emits `unlock {machineId, password}`; a door opens only on `player.knows`.

**48. Street variety is still capped by the body pool: a walker takes any parked body of the same kind and build when their own look is not free.**
Boxes: crowd, cast, app. Evidence: `game/crowd/src/scene-cast.ts:89-97`. The preference is new, the cap is not gone.

**49. No generated city ever contains a tablet.**
Boxes: forge. Evidence: `interior/furnish/pieces.ts:125` accepts it; every call site passes laptop, terminal or monitor.

**50. "Things are overlapping" in the interface has never been reproduced and cannot be worked on.**
Boxes: hud. Evidence: no screenshot exists, the hud has one z-order ladder every style file draws from, and the panels sit apart in both of today's frames. It needs a frame from you before anyone touches a style.

---

## Built, exported, and called by nobody

This is the pattern behind most of the rows above: the box does its half, publishes it, and no caller ever arrives.

| What exists | Where | Nobody calls it from |
|---|---|---|
| The whole minimap surface, and the `minimap` intent | `game/hud/src/surfaces/minimap.ts`, `tabs/settings.ts:38` | game/app — zero grep hits |
| The `fullscreen` intent, on both the F key and a button | `game/hud/src/keys.ts:31`, `hud.ts:149` | nowhere; `requestFullscreen` is in no file |
| `opened(prop)` — swinging an unlocked gate open | `game/furnish/src/dressing.ts:111` | game/app; and `CastDressing` would drop it anyway |
| `shell` forwarding through the cast layer | `game/cast/src/dressing.ts:18-27` | app patches around it by hand |
| `marking(paint)` and `clutter()` on the shipped art kits | promised at `game/scene/CONTRACT.md:289` | `KitDressing` and `PrefabDressing` declare neither |
| `SHADOW_LAYER`, worth a measured 3.4 ms a frame | `game/land/src/shadow.ts:67` | nothing anywhere sets a layer; the cost is still paid |
| `plotOf(hit)` — the only way to turn a raycast into a plot now that buildings are batched | `game/scene/src/index.ts:5` | app targets off world data instead |
| `CityBuild.add(plot)` — one plot into a standing city | `game/scene/CONTRACT.md:32` | applying a pack throws the city away and rebuilds |
| `passwords()` and `scores()` — the words you were given, your best score per machine | `game/play/CONTRACT.md:54,57` | nothing; neither can ever be shown back to you |
| `reachableRoom` — the check that would stop an unreachable quest | `game/nav/src/city-nav.ts:94` | forge, which has no dependency edge to nav |
| `fixturesFor` / `fixtureParts` — subway entrances and door cameras | `game/kitbash/src/index.ts:20-21` | prefab, so pack-built buildings get neither |
| The named `door` empty on every building | `game/kitbash/src/dressing.ts:40-44` | no `getObjectByName` for it in scene, prefab or app |
| `openPlaces` on the build brief | `game/forge/src/brief.ts:28` | app and cli both omit it |
| `staffContact` on a counter | `game/world/src/props.ts:70` | forge, which still anchors everyone customer-side |
| The `tablet` piece | `game/forge/src/interior/furnish/pieces.ts:125` | every call site passes something else |
| `Sprint_Loop` and `Push_Loop` with its trolley, shipping in the 1.31 MB anims.glb | `game/cast/CONTRACT.md:230,253` | on no shelf, in no gait, in no gesture list |