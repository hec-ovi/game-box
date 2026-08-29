import { World, type IntegrityProblem, type Word } from '@gb/world'
import { PLACEHOLDER_KIND } from './placeholders.ts'

/** What one building turned out to be: the kind of place, and the look that is filed under it. */
export interface WrittenPlot {
  readonly name: string
  readonly kind: Word
  readonly style: string
}

/** What the story made of the town: its own name, the name of every part of it, and what every building turned out to be. */
export interface WrittenNames {
  readonly city: string
  /** By district id. */
  readonly zones: ReadonlyMap<string, string>
  /** By plot id. */
  readonly places: ReadonlyMap<string, WrittenPlot>
}

/**
 * Writes the story over the placeholders the architecture was laid out under.
 *
 * The architecture goes up first, under `Zone 1` and `Instance 1` and with
 * every building a `building`, because the work has to be written against real
 * ids before anybody knows what the town is called. This is the pass that turns
 * those into a named city of shops and homes, and it is the only pass that
 * touches them: it rewrites the document and reads it back through the same
 * door a file comes in by, so anything the world will not take fails here
 * rather than halfway through a build.
 *
 * The architecture's own kind goes out with them. A town whose every building
 * the writing said something about carries no trace of it; one with buildings
 * nobody wrote a word about keeps it, because those are still buildings.
 */
export function writeNames(world: World, names: WrittenNames): { ok: true; world: World } | { ok: false; problems: readonly IntegrityProblem[] } {
  const doc = JSON.parse(JSON.stringify(world.toJSON())) as {
    name: string
    charters?: Array<{ word: string }>
    districts?: Array<{ id: string; name: string }>
    plots?: Array<{ id: string; name: string; kind: string; style: string }>
  }
  doc.name = names.city
  for (const zone of doc.districts ?? []) zone.name = names.zones.get(zone.id) ?? zone.name
  for (const plot of doc.plots ?? []) {
    const written = names.places.get(plot.id)
    if (!written) continue
    plot.name = written.name
    plot.kind = written.kind
    plot.style = written.style
  }
  if (!(doc.plots ?? []).some((plot) => plot.kind === PLACEHOLDER_KIND)) {
    doc.charters = (doc.charters ?? []).filter((charter) => charter.word !== PLACEHOLDER_KIND)
  }

  const loaded = World.load(doc)
  if (loaded.ok) return { ok: true, world: loaded.value }
  const error = loaded.error
  const problems: IntegrityProblem[] =
    error.code === 'invalid-document'
      ? error.violations.map((one) => ({ where: one.path, message: one.message }))
      : error.code === 'inconsistent-world'
        ? [...error.problems]
        : [{ where: '(root)', message: error.message }]
  return { ok: false, problems }
}
