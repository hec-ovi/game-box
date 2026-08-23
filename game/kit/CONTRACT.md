# @gb/kit contract

contractVersion: 0.1.1

## Purpose

The four primitives every other box needs: a deterministic random stream, stable entity ids, a result type instead of exceptions, and one way to validate data at a boundary.

## Inputs and outputs

| Export | In | Out |
|---|---|---|
| `new Rng(seed)` | seed string | a stream: `float`, `int(min,max)`, `range`, `chance`, `pick`, `weighted`, `shuffle`, `fork(label)` |
| `Rng.int(min, max)` | two whole numbers | a whole number in `[min, max)`: `max` is never drawn, so `int(0, 2)` gives 0 or 1, and `int(0, list.length)` indexes the list. `max <= min` gives `min` |
| `Rng.fork(label)` | label string | a child stream, stable for that label no matter what the parent draws |
| `new IdMinter(counters?)` | stored counters | `mint(kind) -> "kind_0007"`, `snapshot()` for the world file |
| `contract(name, zodSchema)` | a Zod schema | a `Contract`: `parse -> Result`, `is`, `jsonSchema()` |
| `ok` / `err` / `expect` | a value or error | `Result<T, E>` |

## Errors (closed set)

Nothing throws across this boundary except `expect` (tests and top-level only) and `Rng.pick` on an empty list, which is a programming error, not a data error. Validation failures come back as `Result` with `SchemaViolation[]`.

## Dependencies

`zod` only. No other box.

## Invariants

- Same seed and same call order always produce the same stream. No `Math.random`, no time, no environment reads.
- `fork(label)` depends only on the parent seed and the label, so generating a new plot later cannot shift the numbers an existing plot already drew.
- A minted id is never reused: counters only move forward, and `snapshot()` restores them.
- `Contract.jsonSchema()` is the same schema the validator enforces, so what CONTRACT.md documents and what an LLM is constrained by cannot drift apart.

## How to modify this blackbox safely

Add exports; never change the number stream produced by an existing seed (that silently changes every world ever generated). A change to `Rng`'s algorithm is a breaking change and needs a new class name alongside the old one. Run `pnpm --filter @gb/kit test`.
