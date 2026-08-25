# @gb/kit contract

contractVersion: 0.1.2

## Purpose

The four primitives every other box needs: a deterministic random stream, stable entity ids, a result type instead of exceptions, and one way to validate data at a boundary.

## Inputs and outputs

| Export | In | Out |
|---|---|---|
| `new Rng(seed)` | seed string | a stream; each method below draws exactly one `float` from it, except `shuffle` which draws `length - 1` |
| `Rng.fork(label)` | label string | a child stream, stable for that label no matter what the parent draws |
| `new IdMinter(counters?)` | stored counters (kind to last number used, default empty) | `mint(kind) -> "kind_0007"`: counts from 1 per kind, zero-padded to 4 digits and growing past 9999. `snapshot()` is a copy of the counters for the world file. `IdMinter.kindOf("npc_0007") -> "npc"` (text before the last `_`) |
| `contract(name, zodSchema)` | a Zod schema | a `Contract`: `parse -> Result`, `is`, `jsonSchema()` |
| `ok` / `err` / `expect` | a value or error | `Result<T, E>` |

## Rng ranges

| Method | Range |
|---|---|
| `float()` | `[0, 1)` |
| `int(min, max)` | whole number in `[min, max)`: `max` is never drawn, so `int(0, 2)` gives 0 or 1 and `int(0, list.length)` indexes the list. `max <= min` gives `min` without drawing |
| `range(min, max)` | `[min, max)` as a float; `max <= min` gives `min` |
| `chance(p)` | `true` with probability `p`: `p <= 0` is always `false`, `p >= 1` always `true` |
| `pick(list)` | one element, uniform; empty list throws |
| `weighted(entries)` | one item, proportional to its weight; weights below 0 count as 0; no positive weight throws |
| `shuffle(list)` | a new array, same elements; empty list gives an empty array and draws nothing |

## Errors (closed set)

Nothing throws across this boundary except `expect` (tests and top-level only), `Rng.pick` on an empty list and `Rng.weighted` with no positive weight, which are programming errors, not a data error. Validation failures come back as `Result` with `SchemaViolation[]`.

## Dependencies

`zod` only. No other box.

## Invariants

- Same seed and same call order always produce the same stream. No `Math.random`, no time, no environment reads.
- `fork(label)` depends only on the parent seed and the label, so generating a new plot later cannot shift the numbers an existing plot already drew.
- A minted id is never reused: counters only move forward, and `snapshot()` restores them.
- `Contract.jsonSchema()` is the same schema the validator enforces, so what CONTRACT.md documents and what an LLM is constrained by cannot drift apart.

## How to modify this blackbox safely

Add exports; never change the number stream produced by an existing seed (that silently changes every world ever generated). A change to `Rng`'s algorithm is a breaking change and needs a new class name alongside the old one. Run `pnpm --filter @gb/kit test`.
