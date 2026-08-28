# Places

How a city gets a jail, a university or a corporate campus without either word existing in the engine.

Status: decided. Supersedes the closed `BUILDING_KINDS` rationale in `game/world/src/model/vocabulary.ts`. Read this plus your box's brief in section 6 before touching anything.

## 1. The decision

A place stops being a name the engine knows and becomes a **charter**: an entry in `world.charters`, written by the first generation stage, keyed by whatever word the premise invented, whose every field is either a closed enum the engine ships, a bounded number, or free text that is only printed or hashed. The engine never learns a fiction. It asks the questions it already asks (how does this meet the street, is there a counter at the front, who may go past it, what do people do in here, what does it keep, how tall is it) and every table in every box is re-keyed onto those answers. `plot.kind` holds the word, and the word is legal only because the file declares it. So the vocabulary stays closed exactly as the old rationale demanded, but it is closed **by the world document** instead of by the engine. For the owner's ask: a premise that says "there is a jail" writes a charter called `jail`, and the city gets a windowless masonry block with JAIL down the blade, a duty desk with somebody permanently on it, a guard on his feet by the door, cell rows behind a door that is actually locked, keycards and ledgers on the surfaces, a name and rumours of its own, quests pointing at it, and a landmark on the map. No box branches on the word "jail". The governing rule, and the reason this is not "let the model write the game": **the generator picks axis values, the engine owns every metre, weight, piece id, prop id and clip name.**

All three judges picked this design. Where they disagreed I have resolved rather than averaged, and said so inline.

## 2. What a place is

Two shapes. The **charter** is the authoring surface, what a generator writes and what a human reads. The **resolved charter** is what the world file carries: the charter plus the numbers and piece ids the engine derived from it, written down once so no receiver re-derives anything. This resolve-once rule is lifted from the Trades design and from `Plot.design`, which already does it for prefab art; it closes the one real gap Charters had (a coarse pin: change a table in v0.4 and every v0.3 file resigns itself).

### 2.1 The charter, field by field

About 300 bytes of JSON. A city declares 5 to 15, so 2 to 5 KB.

**Word and text** (never branched on, only printed or hashed)

| Field | Shape | Notes |
|---|---|---|
| key `word` | `^[a-z][a-z0-9-]{0,23}$`, unique | The only fiction in the record. This is what `plot.kind` holds. |
| `label` | lowercase noun, <= 24 chars | What a person says out loud. Goes to `WorldSummary.places[].kind`, the talk brief, the quest writer. |
| `blade` | `^[A-Z0-9 ]{2,8}$` | The word spelled down the blade sign. Charset because `game/kitbash/src/sign/glyphs.ts:120` folds an unknown character to blank; length because `sign/text.ts` shrinks then truncates past 0.12 m. Zero new bytes: the glyph sheet is drawn from code into one fixed atlas. |
| `names` | 1..3 templates | `"{family} Holding"`, `"The {adjective} {noun} House"`. The only interpolations are those three theme words, in any order. |
| `rumours` | 0..3 sentences, <= 300 chars each | Falls back to `premise.common` when empty, so it is optional in practice. |

**Placement**

| Field | Shape | Replaces |
|---|---|---|
| `share` | int 1..10 | the `BASE` row, `game/forge/src/theme/plot-mix.ts:9` |
| `prominence` | `background \| notable \| landmark` | nothing today; feeds the hud map |
| `residential` | boolean | the `HOUSING = ['house','apartment']` literal. This is why a dormitory counts as somewhere people live and a cell block does not, which no name list can express. |

**Mass**

| Field | Shape | Replaces |
|---|---|---|
| `size.storeys` | `[int 1..40, int 1..40]`, low <= high | `storeysFor`, `game/forge/src/layout/plots.ts:99`. This is the field that stops an institution coming out a bungalow with a big sign. |
| `size.sprawl` | `narrow \| wide \| block` | nothing today; a prefab tag and a plot-fitting hint |

**Street**

| Field | Shape | Notes |
|---|---|---|
| `street.frontage` | `masonry \| painted \| shopfront \| curtain \| industrial \| blank` | Keys the kit recipe. The first five are exactly the five `Course` constants in `game/kitbash/src/catalog/recipes.ts:26-30`. `blank` is the one new row: `Brick_BottomTrim` at street level with `Brick_Plain_3` above and no window piece, a windowless brick wall no current recipe produces. |
| `street.openness` | `dense \| even \| sparse` | The window rhythm, 1 / 2 / 3. Together with `frontage` this reproduces all nine distinct recipe rows the table holds today. |
| `street.material` | `masonry \| metal \| mixed` | Prefab tag and scene tint input. Not a kit input: the kit's material follows from `frontage`. |
| `street.voice` | `quiet \| sober \| trade \| loud` | The four `Signage` constants that already exist at `game/kitbash/src/sign/trade.ts:22-25`. |

**Behaviour**

| Field | Shape | Notes |
|---|---|---|
| `access` | `open \| admitted \| private` | `open`: the whole interior walkable. `admitted`: the front room walkable, every room marked `shut` locked behind a key item. `private`: the front door itself needs one. This is the only field in the whole design that buys a behaviour rather than an arrangement. |
| `service` | `none \| counter \| desk \| stalls` | Replaces both the `STAFFED` list (`interior/plan.ts:26`) and the serve-prop choice. Engine-owned map: `counter` -> a counter with a `serve` anchor, `desk` -> a desk with a `serve` anchor, `stalls` -> market stalls, `none` -> no post. |
| `work` | subset of `[desk, bench, cook, floor, watch]`, <= 3 | Each maps engine-side to an anchor kind and a fallback role: `desk` -> `work-desk`/worker, `bench` -> `work-bench`/mechanic, `cook` -> `cook`/cook, `floor` -> `browse`/vendor, `watch` -> `guard`/guard. |
| `holding` | subset of `[goods, food, drink, papers, tools, valuables, medicine, personal]`, <= 3 | Replaces `STOCK` (`populate.ts:66`). Each class maps engine-side to a fixed set of `ITEM_ARCHETYPES`, so `papers` is book/ledger/envelope/keycard and a jail stops holding one anonymous box. |
| `finish` | `domestic \| civic \| industrial \| corporate \| worn` | Selects the furnish language (today always `corpo`, `game/furnish/src/dressing.ts:37`) and a bay-weight row over `BayKind`. Both engine-owned. |

**Rooms**

```
rooms.hall?     { use, name }
rooms.main      { use, name }
rooms.services  [ { use, name, weight 1..3, spare?: bool, shut?: bool } ]   // <= 5
```

`name` is free text (it is only displayed). `use` is a new closed vocabulary, `ROOM_USES`, one value per dressing routine that exists today in `game/forge/src/interior/furnish/`:

```
entrance-hall  waiting-room  lobby  concourse
taproom  cafe-floor  dining-room  shop-floor  market-hall
desk-floor  private-office  bench-floor
ward  assembly
living-room  bedroom  guest-room  kitchen  washroom
store  bulk-store
```

Twenty-one values, not the twelve the original write-up claimed. That claim was an overclaim and I am striking it: merging `bedroom`/`guest-room`, `store`/`bulk-store` and `waiting-room`/`lobby` would be a re-authoring, and the whole reason this design wins is that its interior change is a rename with a fixed point. `assembly` is `nave` with the altar generalised to a front piece plus a `stand` post facing the ranks, which is what makes a lecture hall reachable. `ward` is `treatmentRoom` with the bed count driven by floor area instead of capped at 2, which is what makes a cell row reachable. Those two generalisations are the only routine changes in this document.

The two numbers a generator writes, `share` and `storeys`, are clamped and are the same two numbers a human wrote into `BASE` and `storeysFor`.

### 2.2 The resolved charter, what the file carries

At the end of generation, `@gb/forge` resolves each charter and writes it whole into `world.charters`. Resolution adds:

```
built: {
  street:  { plain: PieceId, window: PieceId, rhythm: 1|2|3 },
  flank:   { plain, window, rhythm },
  upper:   { plain, window, rhythm },
  crown?:  PieceId,
  fascia:  PieceId,
  door:    PieceId,
}
signage: { blade: 0..1, hanging: 0..1, accents: int 0..4, nameplate: 0..1 }
tint:    int 0x000000..0xffffff
suits:   string[]   // prefab tags derived from frontage, material, sprawl, prominence
```

No model ever writes a piece id, so a typo cannot draw a wall with holes in it. `@gb/kitbash` then reads `built` and `signage` and holds no dictionary at all, which is what makes it as portable as prefab. It also lets the fourteen shipped presets keep their bespoke values verbatim: `SIGNAGE` has four named rows and eight one-off rows, so a four-value `voice` axis alone would not have reproduced today's output. Same for the two brick upper-window variants (`chapel` differs from `house` on the same frontage). Presets carry their resolved values; generated charters get the row their axis picks.

Resolved charters are normalised at parse, an idea taken from the Venues design and worth having whichever design won: sort charters by word, sort every map key inside them, clamp every number to range, round every float to three decimals, reject duplicate words. A model that emits `0.7000000001` or reorders its output cannot move a single building.

## 3. What each closed vocabulary becomes

**`BUILDING_KINDS`: deleted.** It is the only list in `vocabulary.ts` that names a fiction. Every other list names a file on disk, a geometry function, or a clip in the GLB. The file's header paragraph gains one sentence: these are closed because each names something the engine ships; what a place *is* is closed by the world document instead.

**`ROOM_KINDS`: stays, and gains `ROOM_USES` beside it.** `Room.kind` is the geometric and labelling value; `Room.use` is which dressing routine runs. Nothing in `@gb/furnish` or `@gb/scene` reads `Room.kind` (checked by grep), so it is a forge-internal value with a schema slot, and merging the two is a later cleanup, not this change.

**`ANCHOR_KINDS`: stays closed, permanently.** An anchor kind is two things at once: a measured standoff (a `lean` body sits 0.44 m off the wall face, `work-desk` at 0.75 m, `serve` against a 1.0 m counter, `sleep` centred on the mattress) and the name of a shelf of clips out of the 28 the pack ships. A university lecture theatre is `sit` anchors with an optional generator-written phrase for `@gb/talk`, never a new `lecture` kind. There is no way to buy new motion without new art the receiver would have to download, and that is the hard ceiling on this whole exercise.

**`NPC_ROLES`: stays closed.** This is the one place the judges split, and it is not close. The Venues design deleted it for free-text titles and said the quest layer was untouched. True of the `@gb/quest` box, false where it matters: `game/forge/src/quests/cast.ts:23` and `:26` hold `GIVER_ROLES` and `WALKER_ROLES` as `ReadonlySet<NpcRole>`, consulted at `:65`, `:66`, `:109`, `:114`, `:125` to pick who hands out work, who walks with you and which places can host a hub. A city of `warder` and `registrar` has zero set members, so every invented place contributes no quest giver and no walker, nothing crashes, no test fails, and the jail the premise demanded is the one building in town with nothing to do in it. `draw.ts` loses its staff test the same way (`works()` is `roleFor(...) !== undefined`), so invented places also get under-ranked for having their doors opened at all. Roles stay closed and `roleFor` keeps returning one. If a fiction wants a warden, the *display* name is free text beside the role, not instead of it.

**`FURNITURE_PROPS`: stays closed.** Each value is a hand-written geometry function under `game/furnish/src/props/` plus a spec that the forge places from. A spec without a builder is a clean throw one call later. Generated props as recipes over `Solid.block` is a real future stage, and it is the only thing that fixes the blandness objection in section 8, but it is out of scope here and it is unusable without this change, because there is nowhere today for a generated place to say which props it wants.

**`ITEM_ARCHETYPES`: stays closed.** Same reason, one folder over. A charter names a `holding` class, and the engine maps the class onto archetypes.

**`BODY_KINDS`, `FACINGS`, `ROAD_KINDS`, `ENTERABLE_KINDS`, the 12 outfits, the 19 kit pieces, the 28 clips, the 8 authored looks, the 14 window photographs: all stay closed.** They are files.

**New closed vocabularies this adds:** `ROOM_USES` (21), `FRONTAGES` (6), `OPENNESS` (3), `MATERIALS` (3), `SIGN_VOICES` (4), `ACCESS_KINDS` (3), `SERVICES` (4), `WORK_KINDS` (5), `HOLDINGS` (8), `FINISHES` (5), `PROMINENCES` (3), `SPRAWLS` (3). All owned by `@gb/world`, all naming a routine or a shipped thing.

## 4. The fallback rule

There is no fallback, and that is the point. Three gates, in order, and the rule is that a place is either fully specified against things that exist or it does not become a place.

**Gate 1, at the schema boundary (`@gb/world`).** Every field a generator writes is a closed enum, a bounded number, or free text with a charset. An unknown trait value fails `CharterSchema` and the charter is refused. An unknown *word* is never a problem, because no branch reads a word. This is the structural difference from the two runner-up designs: they hand a local model programmes, weights, storey ranges and dresser scripts and then defend the result with a probe that proves an interior is non-empty, never that it is right. Here the model picks from twelve small enums and two clamped numbers.

**Gate 2, at generation time (`@gb/forge`), before a single plot takes the word.** For each declared charter: every `use` resolves to a routine; the programme plans a walkable interior with at least one anchor; `drawOf` returns something; the loaded prefab pack answers for this `frontage x material x sprawl` demand or the kit can build it (the kit always can). A charter that fails is **dropped**, its references are stripped from `moreOf`/`fewerOf`/`mustHave`, and the reason is written into the build report the scribe already streams and into `gb check`. Dropping without reporting is the failure this whole exercise exists to remove, so the report is not optional.

**Gate 3, per premise field, not per premise.** Today `premiseOf` returns `undefined` if any field fails, so one bad word in `mustHave` loses `livesOn`, `happened`, `stake`, `sides` and `common` too, and the town is built as if nobody wrote a history. Salvage per charter and per field instead.

**At import (`@gb/bundle`), report, do not refuse.** `game/bundle/src/packs.ts:23` states the box's stance: nothing there refuses anything, a city always opens, and the report is how a caller tells the player that what they are looking at is not what its maker saw. Keep that. The import pass checks every enum value against the receiver's build, every `wear` against the loaded cast manifest, every pinned pack against what the receiver holds, and reports what it lacks. The single exception, where refusal is correct: a `plot.kind` that names no declared charter, because that plot cannot be drawn at all.

## 5. Determinism and portability, as testable invariants

1. **Same file, same city.** A given world file plus a given build produces byte-identical geometry on every machine. Test: hash the built scene graph for a fixed file on two runs.
2. **Same seed and premise, same city.** Test: build a fixed set of seeds crossed with a fixed set of premises, compare whole world hashes.
3. **Adding a charter moves only that charter.** Every per-place draw forks on the word: `rng.fork('mix/' + word)`, `fork('drop/' + word)`, `fork('staple/' + word)`. This is grafted from the Trades design and it is not optional. `kindWeights` today shuffles `BUILDING_KINDS` and draws one `SWING` per kind inside a `map` over the same array (`game/forge/src/theme/plot-mix.ts:86-90`), so list length and order both move the whole town. Replacements: the "drop up to two kinds" roll becomes a per-word key from `fork('drop/' + word)` with the lowest k dropped, k from a fork of its own; staples become the eligible charters sorted by word, each keyed from `fork('staple/' + word)`, lowest k taken. Test: build a seed, add an unused charter, assert every plot outside that charter is unchanged.
4. **The plot seed is the word from the file, never a derived digest.** `plot.kind` is a component of three rng streams (`kitbash/src/compose/plan.ts:47`, `prefab/src/catalogue.ts:181`, `open/${kind}` in `draw.ts`). It stays the word. A later engine that reorders trait fields must not move a window. Explicitly rejected: folding a hash of the charter table into the build seed (the Venues design). It contradicts fork-by-word three paragraphs later in its own write-up, it re-rolls the whole city on any table edit, and it makes the migration test fail by construction.
5. **`drawOf` is keyed on word plus charter hash.** `game/forge/src/interior/draw.ts:36` is a module-level `Map` keyed on the word, memoised across cities in one process. Two cities in one process that both invent `jail` with different charters must not share a `Draw`. Test: plan two different `jail` charters in one process, assert different draws.
6. **Nothing new is ever named.** A charter is a composition over shipped atoms only. Test: a charter cannot express a value outside the closed lists (this is gate 1), and adding a charter adds zero bytes of download.
7. **The receiver re-derives nothing.** Interiors are already fully materialised in the file: rooms, doors, furniture and anchors all carry absolute positions, rotations and lifts (`game/world/src/model/schema.ts:31-87`). The only read-time consumers of `plot.kind` are `kitbash` (recipe, signage, blade, rng seed), `prefab`'s unpinned filter (`catalogue.ts:178`; `pin.ts:27` short-circuits it whenever a design is pinned) and `scene`'s tint table (`dressing.ts:48`). All three read resolved fields off the charter after this change. Test: strip `world.charters` down to words only and assert the render fails at import rather than drawing something different.
8. **Model down, same city.** With no model at all, the forge builds from the fourteen shipped preset charters and produces the city it produces today. Test: the golden hash of invariant 2, run with the sidecar off.

## 6. Per-box work list, in dependency order

Read your box's `CONTRACT.md` and the contracts of anything you depend on. One change lands in one box plus `docs/INDEX.md`.

**Stage 0, lands first, independent of everything else. `@gb/forge` (premise).** Make `premiseOf` salvage per field instead of returning `undefined` when one word fails an enum. A bad `mustHave` entry is dropped; `livesOn`, `happened`, `stake`, `sides` and `common` survive. This is worth landing today and it is not throwaway work. Rejected alternative: shipping `plot.kind: string` plus `resembles: BuildingKind` as a stopgap. It is a day of work, it gets most of the visible result, and it is a temporary local patch meant to be replaced, which is exactly what the house rules forbid. Land the salvage, then build charters properly.

**Stage 1. `@gb/world`.** Publish `CharterSchema`, the twelve new trait enums, `ROOM_USES`, and the resolved `built`/`signage`/`tint`/`suits` shapes. Add `world.charters` (1..24 entries) and `world.charter(word)`. Widen `Plot.kind` and `Interior.kind` to the word pattern with a refine that it is a declared key. Add `Room.use`. Add optional `Anchor.doing` (a free phrase for talk). Ship `SHIPPED_CHARTERS`, the fourteen presets, mechanically transcribed from `BASE`, `TILT`, `storeysFor`, `PROGRAMMES`, `STAFFED`, `STOCK`, `PATTERNS`, `PLACE_KNOWLEDGE`, `RECIPES`, `SIGNAGE`, `TRADE_WORD` and `BUILDING_TINT`. Add the integrity rule: every `plot.kind` resolves in `charters`. Widen `plotsOfKind` at `game/world/src/world.ts:160`, which is typed on `BuildingKind`. Keep `BUILDING_KINDS` exported for one release as the preset word list so nothing breaks on the first commit, then delete it. Add the parse-time normalisation from section 2.2.

**Stage 2, the bulk. `@gb/forge`.** Depends on stage 1.
- `theme/plot-mix.ts`: iterate the declared charters, not `BUILDING_KINDS`. `share` for base weight. Flavour tilt applies through traits, not names (industrial multiplies charters whose `work` includes `bench` or `floor`). `HOUSING` becomes `residential`. `KEYSTONE = 'bar'` becomes a pick over charters where `service !== 'none'` and the probe yields seats, tie-broken on lowest word. `STAPLE_SETS` becomes the same predicate plus `prominence`. Fork per word everywhere (invariant 3).
- `layout/plots.ts`: `storeysFor` reads `size`.
- `interior/recipes.ts`: `PROGRAMMES` deleted, the `Programme` type kept, rooms read off the charter.
- `interior/plan.ts`: `STAFFED` becomes `service !== 'none'`.
- `interior/furnish/index.ts`: the two switches on the building collapse into one switch on `room.use`. The twenty-one routines are the ones that exist, renamed off fictions onto uses. `nave` generalises to `assembly` (altar becomes a front piece plus a `stand` post facing the ranks). `treatmentRoom` generalises to `ward` (bed count from floor area). Nothing else in this folder changes: `concourse`, `warehouseFloor`, `openOffice` and the rest stay hand-written geometry, which is the entire reason this design was chosen over a generated move interpreter.
- `populate.ts`: `roleFor` keeps its anchor-first shape and reads `service`/`work` in the override branch, still returning a closed `NpcRole`. `STOCK` becomes `holding` through the engine-owned class map.
- `narrator/places.ts`, `narrator/knowledge.ts`: templates and rumours off the charter, falling through to `premise.common`.
- `interior/draw.ts`: key the memo on word plus charter hash.
- `premise/shape.ts`: the premise gains `charters`; `moreOf`/`fewerOf`/`mustHave` validate against declared words unioned with the presets.
- New: the resolver (merge, clamp, sort, run gate 2, freeze) and the resolved-field writer.
- `tools/floorplan.ts`: iterate a world's or premise's charters. Keep this working; it is the only way anyone eyeballs an interior before a stranger does.
- Nothing under `src/quests/` changes except that `cast.ts` keeps working because roles stayed closed.

**Stage 2, parallel. `@gb/prefab`.** `model.kinds` becomes `model.tags` in `looks/*.json`, matched against `charter.suits`. `catalogue.ts:22` relaxes the enum to non-empty lowercase strings, so one institutional look can no longer fail a 512-model pack to load and drop every building in the city to the kit. `tools/look.ts` checks shape, not membership. `kindsCovered()` and the test asserting it equals `BUILDING_KINDS` become a demand check in the shape of the existing `covers(demand)`. `pin.ts` is untouched and is the pattern the rest of this copies.

**Stage 2, parallel. `@gb/kitbash`.** `RECIPES` is re-keyed onto `frontage x openness` (fifteen rows, nine of which are today's, plus `blank`). `SIGNAGE` and `TRADE_WORD` are deleted. `planBuilding` and `planSigns` take the resolved `built`, `signage` and `blade` alongside the plot, so this box holds no dictionary and needs no pin of its own. `accent()` loses its `BuildingKind` import. `accents` is already bounded 0..4 by the schema; assert it, because index 4 and up restacks the high board. Add a runtime gate for unknown piece ids: `KitLibrary.parts()` returns `[]` today, which draws a wall with holes and no error.

**Stage 2, parallel. `@gb/scene`.** `dressing.ts:48` holds `BUILDING_TINT`, a `Partial<Record<BuildingKind, number>>` with a grey fallback that every design in the review missed. Read `charter.tint` instead. Resolve the charter for a plot and pass `built`, `signage`, `blade` and `tint` through the `Dressing.building` seam so kitbash stays dictionary-free.

**Stage 2, parallel. `@gb/scribe`.** `place-names.ts`, `instance.ts` and `premise.ts` are typed on `BuildingKind` and are a compile break in any version of this change. Add the prompt that asks the model for a charter dictionary, and the tool schema it is checked against. Tool parameters are generated from the JSON Schema, so the shape follows.

**Stage 2, small. `@gb/furnish`.** No building kind is read today and none is added. Take `finish` at the `Dressing` seam (`dressing.ts:37`, today always `corpo`), which is the cheapest visible win in the repo, and key `BAY_TASTE` on `finish` plus `room.use`. Two bugs this makes live: `heightOf` at `kit/library.ts:100` returns 0 for an unknown prop, which makes every bay clear it and runs a shelf through a wardrobe, the only wrong-picture path in the box, and it should refuse; `staffContact` at `:91` dereferences without the `?.` its three neighbours use. `CONTRACT.md:71` stops claiming an empty error set.

**Stage 2, small. `@gb/talk`.** Prefer `anchor.doing` over the `surroundings` table when the generator wrote a phrase for the spot somebody keeps.

**Stage 2, small. `@gb/hud`.** One optional `prominence` on `MapPlot`, three fills in `style/tokens.ts`, so a jail and a chapel are not two more grey rects. Palette stays hud-owned.

**Stage 2, small. `@gb/cast`.** Nothing required. Optional and separate: pin `npc.appearance.wear` to a shipped outfit id so a fiction can dress a warden without a `warden` role. That kills the silent tie at `wardrobe.ts:74` where an unrecognised role scores 0 against all six outfits and `hash01` puts a bartender's apron behind a prison desk. `@gb/crowd` changes nothing.

**Stage 3, after everything above is green. Locked doors.** `access: admitted | private` is the headline behaviour and it is **not free**, contrary to the original write-up. `Door.locked` exists (`schema.ts:73`), is written `false` at `interior/doors.ts:58` and `:133`, and its only consumer anywhere is the integrity rule at `integrity.ts:91`. So it needs: forge writing `locked` plus `keyItemId` for rooms marked `shut`; a door blocker in `game/app/src/buildings.ts`; a nav edge cut in `@gb/nav`; and a key check in `@gb/play`. Small, four boxes, and it must be budgeted rather than assumed. Those boxes are not "nothing".

**Stage 4. `@gb/bundle`.** The import report from section 4, the upgrade path from section 7, and the refusal for an unresolvable `plot.kind`.

**Stage 5.** Delete `BUILDING_KINDS` and the deprecated alias.

**Unchanged: `@gb/quest`, `@gb/kit`, `@gb/land`, `@gb/traffic`, `@gb/drive`.** Quest was built for this: `PlaceSchema` carries no kind, `references.ts:21` asks whether an id exists rather than what sort of thing it is, and `target.ts` switches on its own eleven verbs.

## 7. What already-exported cities do

They keep working and they keep rendering identically, and there is a test that says so.

A `schemaVersion` 1 file carries `plot.kind` from the fourteen and no `charters`. On load, `@gb/world` resolves each word through `SHIPPED_CHARTERS`, which encode today's tables exactly. Resolution is a pure function of the word, so it is deterministic and needs no rewrite of the file. A missing `Room.use` is derived from `Room.kind` plus the building's preset, which is total because it is the inverse of how the presets were generated.

Exteriors are the safest part: `Plot.design` already pins the prefab model and `pin.ts` prefers the pin over any choice, so every prefab building in every exported city is byte-identical whatever happens to the vocabulary. Kit buildings re-derive, so their recipe must come out the same, and the `frontage x openness` rows are chosen so each of the fourteen presets maps to the recipe it holds today. Where a preset differs from its row in one field (the `chapel` upper window piece, the eight bespoke signage rows), the preset carries the resolved value explicitly, under the same resolve-once rule as everything else.

`@gb/bundle` upgrades a v1 file on import: it writes the resolved presets into `world.charters`, stamps `Room.use`, and leaves `plot.kind` exactly as it is, because the old enum values are already valid words. The city stops depending on a table in anybody's build and becomes self-describing, which is the property this whole design is for. `schemaVersion` goes to 2 (`schema.ts:153` is `z.literal(1)` today and there is no upgrade machinery, so this is real work, budgeted in stage 4). A v2 file opened by an old build fails at the `@gb/world` boundary rather than half-loading, which is the existing fail-closed rule.

The gate is a golden test in `@gb/forge`: fixed seeds crossed with fixed premises, world hashes compared before and after. Same bytes, or the presets are wrong. That test also protects the path, which is the same code with no model in it. It is a refactor check with a fixed point, not a promise, which is why it can be a gate rather than something that gets weakened in week two.

The one thing that is allowed to move: nothing. Invariant 3 exists specifically so the fork-per-word change does not reshuffle existing seeds. If a preset transcription is wrong, the golden test fails and the transcription gets fixed; the seed does not get to move.

## 8. The strongest argument against this

**It buys arrangement, not geometry, and arrangement is the smaller half.** The renderable atoms do not move: 24 furniture props, 19 kit pieces, 8 authored looks, 14 window photographs, 2 interior languages, 28 clips on one 65-joint skeleton. So the jail has no bars, no cell door, no gate and no wire; it has beds behind a locked door, a guard playing the same clip as a warehouse watchman, and a windowless brick wall. The university has no lectern and no lecture bench; it has chairs in ranks facing a table with a person standing at it, which is the chapel move with the altar renamed. A player who walks into both will read "institution" in both and may not read which. This converts the owner's stated failure case, a house with the wrong sign, into a milder one, a generic institution with the right silhouette. The difference between his jail and his university lands at maybe a fifth of what is on screen: frontage, storey count, seat arrangement, one locked door, the items on the surfaces, the word on the blade. It gets worse one layer down, and prefab shows it plainly: which room a ground-floor window looks into is a height test plus a uv shift over those fourteen photographs (`game/prefab/src/rooms.ts:16-30`), so a jail's windows still look into a bar or a noodle counter and no code notices. The enum was never what stopped a university existing. The art was.

**Taste stops being reviewable at the moment there is more of it to review.** Today fourteen rows are right or wrong and `tools/floorplan.ts` draws all fourteen on one sheet in a second. Six frontages by three openness by four services by three accesses by twenty-one room uses is thousands of combinations nobody authored, and the ones nobody thought about (stalls in a blank-fronted private block, `assembly` in a 3 m room, `ward` with `service: stalls`) will be generated, will not crash, and will not be seen by anyone before a stranger opens the file. Gate 2 catches the empty cases and none of the merely bad ones.

**And the scope is real.** Ten boxes, a schema version, a rewrite of forge's interior dispatch, re-keyed tables in kitbash, prefab and scene, and a stage-3 tail across nav, app and play for the one behaviour that actually differentiates a jail. That is not a week.

The answer, and it is a bet rather than a proof: this makes the art reachable without new engine branches. A new prop, a new look, a new window picture, a new clip becomes a value an existing charter can already select, and every already-exported city pins what it used and cannot move. That is the owner's "once we have the technique, all would be adding more space" with the cost bounded once. The visible payoff on the day `BUILDING_KINDS` dies is a distinct silhouette, a plausible floor plan, a locked back room and the right word on the blade. If anyone expects to walk into a recognisable jail that day, they will not, and that expectation should be corrected now rather than in a month.
