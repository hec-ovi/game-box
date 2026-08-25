# @gb/cli contract

contractVersion: 0.3.0

## Purpose

The terminal surface: generate a city, to a history of your own if you wrote one, pin it to the art it was drawn from, write it as a bundle, and look at what came out.

## Inputs

| Command | Arguments | Preconditions |
|---|---|---|
| `gb build` | `--theme --seed --blocks NxN --cells --density --storeys --exits --model --history --out` | `--model` needs the sidecar running on `GAME_BOX_URL`, or it falls back per call. `--history <file>` is a JSON object: `@gb/world`'s `Premise` plus `charters`, each a `CharterSchema`; it is taken as the narrator's answer to `writePremise`, so the forge gates it the way it gates a model's and the report says what was dropped |
| `gb inspect <file>` | a bundle written by `gb build` | |
| `gb check <file>` | a bundle | |
| `gb help` | | |

`run(argv, io)` is the whole implementation; `bin.ts` only supplies `process.argv` and the console, so every command is testable without a terminal.

## Outputs

| Command | Result |
|---|---|
| `build` | a bundle file, plus a summary: size, counts, every kind of place the history declared that the city would not take with why (`Forge.build`'s `dropped`, one line each, never left out), whether nothing of a `--history` file could be read as a history, quests written and quests rejected, the pack the city was designed against and how many buildings are pinned to it, how many model calls fell back, the content hash |
| `inspect` | the grid as characters, then every place with who is in it, then every quest with its steps |
| `check` | opens the bundle the way the game would, then walks the city to prove every building can be reached |

`inspect` and `check` say first when the file was written before charters and is read against the presets it was drawn with (`Bundle.open`'s `upgraded`). What a file cannot say is what its build dropped: the report at `build` is the one place that is said.

Exit code is 0 when the command did what it says, 1 otherwise.

## Errors (closed set)

Nothing throws at the boundary. A failure prints why on `err` and exits 1: an unbuildable brief, a history file that is not there or not a JSON object, a city the world took a catalogue for and then refused a design for, a bundle file that cannot be read, a bundle that will not open (with the first ten problems, or the words of a kind of place it does not describe), a missing file argument, an unknown command.

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

Pinning is on for every `gb build`, including a throwaway local one, and there
is no way to turn it off.

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

- `check` is the honest test of a shipped city: it opens the bundle through `@gb/bundle` exactly as the game does, then adds the one thing a schema cannot say, that the city can actually be walked.
- `build` never half-writes: the bundle is packed and sealed before the file is touched, and the pins are written before it is packed, so the content hash covers them.
- Pins are all or nothing. A world that has taken a catalogue cannot give it back, so a design the world refuses fails the build with nothing written rather than leaving a city part pinned.
- The offline narrator is the default. `--model` is opt-in, and a model that will not answer degrades to the offline narrator rather than failing the build.

## How to modify this blackbox safely

A new command is a new module plus a line in the switch and in the usage text. Keep `run(argv, io)` free of `process` and `console`. Who writes a city is `src/narrator.ts` alone: the model or the offline narrator, and a history file in place of either's story. Opening a file for `inspect` and `check` is `src/open.ts`, which is where a refusal is put into words. What a city is pinned to lives in `src/pins.ts` alone; the size a pin is made against is the one `@gb/scene` hands `Dressing.building`, so it moves only when that does. `tests/fixtures/before-charters.json` is a `schemaVersion` 1 city kept as it was shared, the proof that an older file is opened and said to be older; `tests/fixtures/history.json` is a history with one charter the gate takes and one it drops. The `gb` script runs on `node --experimental-transform-types`, which is what `@gb/prefab` needs to load from source. Run `pnpm --filter @gb/cli test`.
