# @gb/cli contract

contractVersion: 0.1.0

## Purpose

The terminal surface: generate a city, write it as a bundle, and look at what came out.

## Inputs

| Command | Arguments | Preconditions |
|---|---|---|
| `gb build` | `--theme --seed --blocks NxN --cells --density --storeys --model --out` | `--model` needs the sidecar running on `GAME_BOX_URL`, or it falls back per call |
| `gb inspect <file>` | a bundle written by `gb build` | |
| `gb check <file>` | a bundle | |
| `gb help` | | |

`run(argv, io)` is the whole implementation; `bin.ts` only supplies `process.argv` and the console, so every command is testable without a terminal.

## Outputs

| Command | Result |
|---|---|
| `build` | a bundle file, plus a summary: size, counts, quests written and quests rejected, how many model calls fell back, the content hash |
| `inspect` | the grid as characters, then every place with who is in it, then every quest with its steps |
| `check` | opens the bundle the way the game would, then walks the city to prove every building can be reached |

Exit code is 0 when the command did what it says, 1 otherwise.

## Errors (closed set)

Nothing throws at the boundary. A failure prints why on `err` and exits 1: an unbuildable brief, a bundle that will not open (with the first ten problems), a missing file argument, an unknown command.

## Dependencies

`@gb/forge`, `@gb/scribe`, `@gb/bundle`, `@gb/nav`, `@gb/world` contracts.

## Invariants

- `check` is the honest test of a shipped city: it opens the bundle through `@gb/bundle` exactly as the game does, then adds the one thing a schema cannot say, that the city can actually be walked.
- `build` never half-writes: the bundle is packed and sealed before the file is touched.
- The offline narrator is the default. `--model` is opt-in, and a model that will not answer degrades to the offline narrator rather than failing the build.

## How to modify this blackbox safely

A new command is a new module plus a line in the switch and in the usage text. Keep `run(argv, io)` free of `process` and `console`. Run `pnpm --filter @gb/cli test`.
