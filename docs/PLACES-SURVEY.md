# What every box does with a building kind

Measured 2026-08-23 by `@gb/world`, by adding three kinds and reading the
compiler, then reading each dispatch site. This is the evidence the open-places
design has to survive. It was gathered for a change that was then cancelled: the
owner rejected extending the closed list, in these words.

> "i did not asked those places, can be anything at all, a jail, a university, a
> big complex corporation... those are just instances in the end, i do not want
> to overfit on those specifically is what i mean, the idea is that those are
> dynamic, flexible, and the first generations decides what goes there depending
> on the request"

## Tier 1: total records, so a new kind does not compile

A kind with no entry is a build error, not a bad building. Ten sites, two boxes.

| Box | Site | What it holds |
|---|---|---|
| forge | `src/theme/plot-mix.ts:9` `BASE` | base weight in the mix |
| forge | `src/interior/recipes.ts:33` `PROGRAMMES` | which rooms the place has |
| forge | `src/narrator/places.ts:15` `PATTERNS` | how its name is composed |
| forge | `src/narrator/knowledge.ts:57` `PLACE_KNOWLEDGE` | what people there know |
| forge | `tests/interior.test.ts:448` | expected props and anchors per kind |
| kitbash | `src/sign/trade.ts:27` `SIGNAGE` | how loudly the trade signs itself |
| kitbash | `src/sign/trade.ts:49` `TRADE_WORD` | the word on the sign |
| kitbash | `src/catalog/recipes.ts:48` `RECIPES` | what the facade is made of |

Roles have two more: `forge/src/narrator/knowledge.ts:5` `ROLE_TRAITS` and `:41`
`ROLE_KNOWLEDGE`.

## Tier 2: degrades on its own, and this is the good news

The interior already does not care much what a building is called.

- `forge/src/interior/furnish/index.ts` dispatches on **`ROOM_KINDS` first**;
  the building kind is only a tiebreak with a `default:`. An unknown kind gets
  `livingRoom` for its main room and `entranceHall` for its hall.
- `forge/src/populate.ts:5` `roleFor` dispatches on **`ANCHOR_KINDS` first**.
  Unknown kind: `serve` becomes `receptionist`, everything else already answers.
- `forge/src/interior/draw.ts:43` `drawOf` is **derived, not tabulated**: it
  plans a probe interior and counts counters, staff, seats, beds and stock. So
  whether a door is worth opening needs no per-kind case at all, only a room
  programme.
- Partial records that simply fall back: `TILT` (no theme tilt), `STOCK` (no
  loose stock), `plots.ts:100` (1 to 2 storeys), `scene/src/dressing.ts:48`
  `BUILDING_TINT` (default tint). `crowd/src/people.ts:9` `STREET_ROLES` is a
  filter, so a new role never walks the street.

## Tier 3: compiles, tests fail

- `prefab/tests/pack.test.ts:149` asserts `catalogue.kindsCovered()` equals
  `BUILDING_KINDS` **exactly**, so the committed pack must claim every kind, and
  it also fails if a kind is removed.
- `cast/tests/wardrobe.test.ts:47` asserts every role has an outfit. The runtime
  falls back; the test does not allow it.
- `scribe/src/premise.ts:36` joins the list into the write-premise prompt and
  `scribe/tests/premise.test.ts:58` checks each appears. Both follow the enum.

## Two facts the design must build on

**The enum's order and length are part of every city's identity.**
`forge/src/theme/plot-mix.ts:87` shuffles `BUILDING_KINDS` with a seeded rng, so
changing either lays out a different town for every existing seed. Any redesign
that reorders or resizes this list breaks replay for every city already shared.

**`ENTERABLE_KINDS` is gone.** It had zero readers anywhere in the repo, and it
contradicted how doors are actually chosen: forge ranks a door by what its
dresser turns out to make, not by the kind's name. A frozen list of "kinds you
may walk into" was the same shape the owner rejected.

## One correction owed

`@gb/forge`'s contract claims a kind with no case "generates an empty shell". It
does not: it generates a house with a receptionist.
