import { err, ok, type Result, type SchemaViolation } from '@gb/kit'
import type { WorldDoc } from '../self-describing.ts'
import { stableJson } from '../stable-json.ts'
import { addedByKey, appended } from './appended.ts'
import { GridDelta } from './grid-delta.ts'
import type { ExtensionDoc } from './schema.ts'

/** Every field that is neither a list of records, the ground nor the counters: the base's, and an extension leaves it as written. */
const FIXED = ['format', 'schemaVersion', 'id', 'name', 'theme', 'brief', 'asks', 'seed', 'generator', 'cellSize', 'premise', 'roads'] as const

/**
 * What an extended world document holds beyond its base, and how to put it
 * back. Records are only ever appended, charters and catalogues only ever
 * declared, ground only ever built on, and counters only ever advanced, so
 * the base plus the extension is the extended city and nothing in the base
 * moved.
 */
export class Extension {
  readonly doc: ExtensionDoc

  // written out rather than as a constructor parameter property: `gb` runs
  // under node's strip-only TypeScript, which refuses one outright
  constructor(doc: ExtensionDoc) {
    this.doc = doc
  }

  /** The extension between two documents, or every place the extended one changed what the base had. */
  static between(base: WorldDoc, extended: WorldDoc): Result<Extension, SchemaViolation[]> {
    const problems: SchemaViolation[] = []
    const take = <T>(result: Result<T, SchemaViolation[]>, fallback: T): T => {
      if (result.ok) return result.value
      problems.push(...result.error)
      return fallback
    }
    for (const key of FIXED) {
      if (stableJson(base[key]) !== stableJson(extended[key])) problems.push({ path: key, message: 'changed since the base' })
    }
    for (const [name, count] of Object.entries(base.idCounters)) {
      if ((extended.idCounters[name] ?? 0) < count) problems.push({ path: `idCounters.${name}`, message: 'counts back from the base' })
    }
    const doc: ExtensionDoc = {
      idCounters: extended.idCounters,
      cells: [...take(GridDelta.between(base.grid, extended.grid), new GridDelta([])).cells],
      charters: take(addedByKey(base.charters ?? [], extended.charters ?? [], (charter) => charter.word, 'charters'), []),
      catalogues: take(addedByKey(base.catalogues ?? [], extended.catalogues ?? [], (ref) => ref.pack, 'catalogues'), []),
      plots: take(appended(base.plots, extended.plots, 'plots'), []),
      interiors: take(appended(base.interiors, extended.interiors, 'interiors'), []),
      npcs: take(appended(base.npcs, extended.npcs, 'npcs'), []),
      items: take(appended(base.items, extended.items, 'items'), []),
      placements: take(appended(base.placements, extended.placements, 'placements'), []),
    }
    if (problems.length > 0) return err(problems)
    const rebuilt = new Extension(doc).applyTo(base)
    if (!rebuilt.ok || stableJson(rebuilt.value) !== stableJson(extended)) {
      return err([{ path: '(root)', message: 'the extended city is not the base plus what it added' }])
    }
    return ok(new Extension(doc))
  }

  /** The base document with this extension in it. */
  applyTo(base: WorldDoc): Result<WorldDoc, SchemaViolation[]> {
    const grid = new GridDelta(this.doc.cells).applyTo(base.grid)
    if (!grid.ok) return grid
    return ok({
      ...base,
      ...declared('charters', base.charters, this.doc.charters),
      ...declared('catalogues', base.catalogues, this.doc.catalogues),
      grid: grid.value,
      plots: [...base.plots, ...this.doc.plots],
      interiors: [...base.interiors, ...this.doc.interiors],
      npcs: [...base.npcs, ...this.doc.npcs],
      items: [...base.items, ...this.doc.items],
      placements: [...base.placements, ...this.doc.placements],
      idCounters: this.doc.idCounters,
    })
  }
}

/** A declared list with the additions on the end, written only when the base carries the field or the pack adds to it, so the bytes stay the base's otherwise. */
function declared<K extends 'charters' | 'catalogues'>(key: K, base: WorldDoc[K], added: NonNullable<WorldDoc[K]>): Partial<Pick<WorldDoc, K>> {
  if (base === undefined && added.length === 0) return {}
  return { [key]: [...(base ?? []), ...added] } as Partial<Pick<WorldDoc, K>>
}
