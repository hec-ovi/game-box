# gb-models contract

contractVersion: 0.1.0

## Purpose

Find a model file in the local cache and prove it is the right one before anything loads it.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `entry` (per `Cache::resolve`) | [schema/model-entry.json](schema/model-entry.json) | `file` is a bare filename (no path separators); `sha256` is 64 lowercase hex chars |
| cache root | `Cache::open()` reads `GAME_BOX_MODELS_DIR`, `Cache::at(dir)` takes one | directory need not exist yet |

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `resolved` (from `Cache::resolve`) | [schema/resolved-model.json](schema/resolved-model.json) | the file exists at `path` and its digest equals `sha256` |
| `Cache::root()` | filesystem path | the directory cached files are read from |

## Errors (closed set)

- `InvalidEntry`: entry failed schema validation. Nothing is read from disk.
- `Missing`: the file is not in the cache. Carries the expected path.
- `Integrity`: the cached file's sha256 does not match the entry. Carries both digests.
- `Unreadable`: the file exists but could not be read.

## Dependencies

None (no other layer contracts).

## Invariants

- Nothing is ever handed back unverified: `resolve` either returns a digest-checked file or an error (fail closed).
- Digests are computed streaming, so a multi-gigabyte model never lands in memory.
- `file` is a bare filename, so an entry cannot reach outside the cache root.
- The cache root is `GAME_BOX_MODELS_DIR` when set, else the platform cache directory (`XDG_CACHE_HOME`, `LOCALAPPDATA`, or `HOME/.cache`) plus `game-box/models`. No path from a user's home is ever hardcoded.
- Downloading is not part of this contract yet; `Missing` is how a caller learns a fetch is needed.

## How to modify this blackbox safely

Keep `Cache::open` / `Cache::at` / `resolve` / `root` as the whole boundary. Download-on-first-run arrives as a new method plus a new error variant and a minor contractVersion bump; `resolve` keeps its meaning (check, never fetch). Run `cargo test -p gb-models`; update this file and `schema/` in the same change.
