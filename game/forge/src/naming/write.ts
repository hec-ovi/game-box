import { World, type IntegrityProblem } from '@gb/world'

/** What the story called the town: its own name, the name of every part of it, and the sign over every door. */
export interface WrittenNames {
  readonly city: string
  /** By district id. */
  readonly zones: ReadonlyMap<string, string>
  /** By plot id. */
  readonly places: ReadonlyMap<string, string>
}

/**
 * Writes the town's names over the placeholders it was laid out under.
 *
 * The architecture goes up first, under `Zone 1` and `Instance 1`, because the
 * work has to be written against real ids before anybody knows what the town
 * is called. This is the pass that turns those into names, and it is the only
 * pass that touches them: it rewrites the document and reads it back through
 * the same door a file comes in by, so a name the world will not take fails
 * here rather than halfway through a build.
 */
export function writeNames(world: World, names: WrittenNames): { ok: true; world: World } | { ok: false; problems: readonly IntegrityProblem[] } {
  const doc = JSON.parse(JSON.stringify(world.toJSON())) as {
    name: string
    districts?: Array<{ id: string; name: string }>
    plots?: Array<{ id: string; name: string }>
  }
  doc.name = names.city
  for (const zone of doc.districts ?? []) zone.name = names.zones.get(zone.id) ?? zone.name
  for (const plot of doc.plots ?? []) plot.name = names.places.get(plot.id) ?? plot.name

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
