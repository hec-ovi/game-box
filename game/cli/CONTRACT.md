# @gb/cli contract

contractVersion: 0.4.0

## Purpose

The terminal surface: generate a city, to a history of your own if you wrote one, pin it to the art it was drawn from, write it as a bundle, grow it into a pack that applies to it alone, and look at what came out.

## Inputs

| Command | Arguments | Preconditions |
|---|---|---|
| `gb build` | `--theme --seed --blocks NxN --cells --density --storeys --exits --model --history --out` | `--storeys` is `@gb/forge`'s own ceiling unless you name one (24, 40 at most): over four the city raises a skyline of kit towers. `--model` needs the sidecar running on `GAME_BOX_URL`, or it falls back per call. `--history <file>` is a JSON object: `@gb/world`'s `Premise` plus `charters`, each a `CharterSchema`; it is taken as the narrator's answer to `writePremise`, so the forge gates it the way it gates a model's and the report says what was dropped |
| `gb extend <base>` | `--count --model --out` | `base` is a bundle. The growth is drawn with the base's own seed, `--count` is how many buildings to add (default 10) and the land decides how many fit |
| `gb pack <base> <extended>` | `--out` | two bundles, the second written by `gb extend` from the first |
| `gb apply <base> <pack>` | `--out` | a bundle and a pack cut from it |
| `gb inspect <file>` | a bundle | |
| `gb check <file>` | `--base` | a bundle, or a pack; `--base <bundle>` is for a pack |
| `gb help` | | |

`run(argv, io)` is the whole implementation; `bin.ts` only supplies `process.argv` and the console, so every command is testable without a terminal.

## Outputs

| Command | Result |
|---|---|
| `build` | a bundle file, plus a summary: size, counts, every kind of place the history declared that the city would not take with why (`Forge.build`'s `dropped`, one line each, never left out), whether nothing of a `--history` file could be read as a history, quests written and quests rejected, the pack the city was designed against and how many buildings are pinned to it, how many model calls had to be asked again and why, the content hash |
| `extend` | a bundle file of the grown city, the base file untouched, plus a summary: what was added (buildings, how many of them open, people, things, and how many were asked for when the land ran out), the city's counts in all, the pack the growth was designed against and how many of the added buildings are pinned to it, the content hash |
| `pack` | a pack file, plus a summary: the base it names by world id and content hash, what it adds (buildings, interiors, people, things, quests), the size of the city it applies to with that city's hash, the pack's own hash |
| `apply` | a bundle file of the grown city under the hash `Pack.apply` gave it, plus a summary: counts, how many buildings came from the pack, the hash |
| `inspect` | the grid as characters, then every place with who is in it, then every quest with its steps |
| `check` | for a bundle: opens it the way the game would, then walks the city to prove every building can be reached. For a pack: the base it names by world id and hash and what it adds, off the file alone; with `--base`, applies it the way the game would, which proves its seal, and walks the city that gives |

`inspect` and `check` say first when the file was written before charters and is read against the presets it was drawn with (`Bundle.open`'s `upgraded`). What a file cannot say is what its build dropped: the report at `build` is the one place that is said.

Exit code is 0 when the command did what it says, 1 otherwise.

## Errors (closed set)

Nothing throws at the boundary. A failure prints why on `err` and exits 1: an unbuildable brief, a history file that is not there or not a JSON object, a city the world took a catalogue for and then refused a design for, a base drawn against another version of the pack this build has, a bundle or pack file that cannot be read, a bundle that will not open (with the first ten problems, or the words of a kind of place it does not describe), a grown city that is not an extension of its base (`not-an-extension`, by path), a pack that will not apply (`invalid-pack` by path, `content-changed`, `pack-mismatch` with the base it names and the base it was given, and everything `open` answers), a file that says it is a pack and names no base, a missing file argument, a count that is not a whole number above zero, an option the command does not take, an unknown command.

## Adding to a finished city

A city is generated, played, and later added to as its own authored step, and
the result has to be the same city on every machine. Three commands, each one
file in and one file out:

- **`extend`** opens the base, grows its `World` with `Forge.extend` (the
  base's own seed, so the same base grows the same way twice), pins every added
  building the way `build` pins a city, and writes the grown city as a new
  bundle. The base file is never written.
- **`pack`** opens the base and the grown city separately and hands both to
  `Pack.cut`, which holds the grown city to being an extension (every base
  record byte for byte, growth only on empty ground) and writes only what was
  added: plots, interiors, people, things, placements, cells, charters and
  catalogues the base lacked, and quests. The pack is applied back through
  `Pack.apply` before it is written, so a pack that will not apply is never
  written.
- **`apply`** opens the base, applies the pack, and writes the city that gives
  under the hash `Pack.apply` reports. That hash is `Bundle.pack`'s with the
  pack's own `createdWith.generator`, so the file is sealed with the generator
  the pack names and refused, nothing written, if the two hashes ever differ:
  the same base and the same pack must not name two cities.

The grown city and the pack both say `gb extend` generated them, which is what
makes the file `apply` writes the file `extend` wrote, byte for byte. That is
the determinism proof in `tests/pack.test.ts`: the same base and the same pack
applied twice give identical bytes, and those bytes are the grown city.

**What the growth is pinned to.** The reader's committed pack, when it is the
pack the base names at the same version and bytes, or when the base names no
art at all (then the pack goes on the grown city's `catalogues` and `requires`,
and travels in the pack as a catalogue the base lacked). A base drawn against
another version of the pack is refused before anything is grown: a pin to art
the city does not name buys nothing, and `Pack.cut` reads a second version of
one pack as a change to the base. With a base that names no art, `Pack.apply`
answers the base's empty `requires` (handover 235), so the city `apply` writes
from such a base names the pack in its document and not in its envelope, and
hashes differently from the grown file.

**Quests.** A pack carries the quests written for the growth. `Forge.extend`
answers the plots it added and writes none, so a pack cut by `gb pack` carries
the base's quest list unchanged; writing quests for a growth is `@gb/forge`'s
(handover 223).

## What a built city is pinned to

A city is generated once and added to later, so every building that was already
there has to come back the same building. Which model a plot gets is otherwise
a function of the catalogue, and the catalogue grows: on a 66 building city,
adding one look to the pack moves 26 of them for anyone reading the choice off
the art instead of off the file. So `build` writes the choice down before it
seals anything.

- **`@gb/prefab` reads the committed pack headless**, from `PACK_MANIFEST`, with
  no renderer and no canvas.
- **The pack goes in the envelope**: `catalogue.identity` (pack, version, and
  the sha256 of the manifest, which covers all five binaries) is passed to
  `Bundle.pack` as `requires`, so a reader is told which art this is and a
  rebuilt atlas is a named disagreement rather than a city that looks wrong.
- **The choice goes in the document**: every plot the pack has a shape for is
  recorded with `world.recordDesign`, against the size `@gb/scene` hands the
  dressing (`rect.w` and `rect.h` in cells times `cellSize`, and
  `heightOf(storeys)`) and the `suits` of the plot's charter
  (`world.charter(plot.kind)`), which is what the pick matches a look on. A pin
  made against any other size names a model of the wrong shape, which the pack
  refuses to honour, so the plot falls back to the kit and the pin bought
  nothing; one made against other suits names a building the plot is not
  drawn with.
- **A plot the pack has no shape for is not pinned**, and keeps falling back to
  `@gb/kitbash`. The file promises nothing it did not choose.
- **A pack that cannot be read pins nothing at all**, and the summary says so.
  A city with no catalogues is honestly unpinned; a city naming a catalogue with
  no plot pinned to it reads as pinned and is not.

### Why every build, and not a flag

Pinning is on for every `gb build` and every `gb extend`, including a
throwaway local one, and there is no way to turn it off.

- **It costs 0.2 s and 8.5% of the file.** The 0.2 s is loading `@gb/prefab`
  once; reading and validating the 512 model manifest is 8 ms, and the pass over
  the plots is arithmetic. A 66 building city grows by 10 kB.
- **The default has to be the honest one.** A flag would mean the file people
  actually export is the one that can be quietly re-skinned, and a pack could be
  applied to it a year later with nobody able to say what moved.
- **It ties the file to a pack, and that is the point.** A reader whose pack has
  moved on still opens the city and still draws every pinned building; what
  changes is that `@gb/bundle` can now name the difference instead of guessing.
- **The escape hatch is real, not a flag.** A pack that will not load is already
  handled: the city is written unpinned and says so.

## Dependencies

`@gb/forge`, `@gb/scribe`, `@gb/bundle`, `@gb/nav`, `@gb/world`, `@gb/prefab` contracts.

## Invariants

- `check` is the honest test of a shipped city: it opens the bundle through `@gb/bundle` exactly as the game does, then adds the one thing a schema cannot say, that the city can actually be walked. A pack gets the same test through `Pack.apply` when its base is given.
- `build`, `extend`, `pack` and `apply` never half-write: what goes to disk was sealed first and read back through the door everyone else uses (`Bundle.open`, or `Pack.apply` for a pack), and the pins are written before it is packed, so the content hash covers them.
- Pins are all or nothing. A world that has taken a catalogue cannot give it back, so a design the world refuses fails the command with nothing written rather than leaving a city part pinned.
- A base is read and never written. `extend` opens it into a new file, `pack` and `apply` read it beside a second file.
- The offline narrator is the default, and it is a developer's city: templates, fast and deterministic, with no story in it. `--model` is the real thing, and under it a model that will not answer stops the build and says which stage and why, because a city somebody asked a story of is written by the model or it is not written. What is retried, dropped or settled rather than fatal is `@gb/scribe`'s to say: a side errand it cannot write is dropped and reported, a name it repeats is kept, and pay outside its band is settled.

## How to modify this blackbox safely

A new command is a new module, a parser in `src/args.ts`, a line in the switch and in the usage text. Keep `run(argv, io)` free of `process` and `console`. Who writes a city is `src/narrator.ts` alone: the model or the offline narrator, and a history file in place of either's story. Opening a file for `inspect`, `check`, `pack` and `apply` is `src/open.ts`, which is where a refusal is put into words; `src/walk.ts` is the reachability walk `check` adds. What a city is pinned to lives in `src/pins.ts` alone; the size a pin is made against is the one `@gb/scene` hands `Dressing.building`, so it moves only when that does. The label a grown city and its pack are generated under is `GROWTH` in `src/extend.ts`, and `apply` reads it back off the pack. `tests/fixtures/before-charters.json` is a `schemaVersion` 1 city kept as it was shared, the proof that an older file is opened and said to be older; `tests/fixtures/history.json` is a history with one charter the gate takes and one it drops. The `gb` script runs on `node --experimental-transform-types`, which is what `@gb/prefab` needs to load from source. Run `pnpm --filter @gb/cli test`.
