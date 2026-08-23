import { contract, Rng, type SchemaViolation } from '@gb/kit'
import { BUILDING_KINDS, type BuildingKind, type Plot } from '@gb/world'
import { z } from 'zod'
import { bucketKey, bucketOf, type Bucket } from './bucket.ts'

/**
 * How many places along a wall a plot's rooms can start. Enough that a street
 * of one model is a street of different rooms, small enough that the uv stays
 * far inside what a float carries a picture's worth of precision over.
 */
const ROOM_SHIFTS = 48

const ModelSchema = z.object({
  /** `<look>-<front>x<depth>x<storeys>`. */
  id: z.string().min(1),
  look: z.string().min(1),
  front: z.number().positive(),
  depth: z.number().positive(),
  storeys: z.number().int().positive(),
  /** Trades this look suits. The pick filters on it before it draws. */
  kinds: z.array(z.enum(BUILDING_KINDS)).min(1),
  triangles: z.number().int().nonnegative(),
  /** Where the door's middle sits along the front face, from its middle, in metres. */
  door: z.object({ along: z.number() }),
})

/** One stacked array texture the pack ships: how big a layer is, how many, and the bytes it has to be. */
const StripSchema = z.object({
  size: z.number().int().positive(),
  layers: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
})

export const CatalogueSchema = z.object({
  pack: z.string().min(1),
  version: z.string().min(1),
  /** SHA-256 of the mesh file this manifest describes, lowercase hex. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  producer: z.string().min(1),
  atlas: z.object({
    colour: StripSchema,
    emissive: StripSchema,
    /** The rooms every window in the city looks into. */
    rooms: StripSchema,
    /** The pictures every screen in the city carries. */
    screens: StripSchema,
    /** What each layer of the two facade strips paints, in order. The runtime reads which of them have windows off this. */
    finishes: z.array(z.string().min(1)).min(1),
  }),
  models: z.array(ModelSchema).min(1),
})

export type ModelSpec = z.infer<typeof ModelSchema>
export type CatalogueDoc = z.infer<typeof CatalogueSchema>

const catalogueContract = contract('prefab-catalogue', CatalogueSchema)

/** Which model a plot gets, whether it is drawn the other way round, and where its rooms start. */
export interface Design {
  readonly model: string
  readonly mirror: boolean
  /** Whole wall pictures to slide the uv along, so two plots on one model do not share their rooms. */
  readonly rooms: number
}

export interface Uncovered {
  readonly ok: false
  readonly missing: readonly Bucket[]
}

export class InvalidCatalogue extends Error {
  readonly code = 'invalid-catalogue'
  constructor(readonly violations: readonly SchemaViolation[]) {
    super(`prefab catalogue rejected: ${violations.map((v) => `${v.path} ${v.message}`).join('; ')}`)
    this.name = 'InvalidCatalogue'
  }
}

/**
 * Every building the pack holds, and which one a plot gets. Nothing here
 * touches three.js: it is the list and the choice, so it can be checked in Node
 * and read by the pack builder as well as by the dressing.
 */
export class Catalogue {
  readonly pack: string
  readonly version: string
  readonly sha256: string
  readonly atlas: CatalogueDoc['atlas']
  readonly models: readonly ModelSpec[]
  readonly #byId: ReadonlyMap<string, ModelSpec>
  readonly #byBucket: ReadonlyMap<string, readonly ModelSpec[]>

  private constructor(doc: CatalogueDoc) {
    this.pack = doc.pack
    this.version = doc.version
    this.sha256 = doc.sha256
    this.atlas = doc.atlas
    // sorted by id, so the order the manifest happens to list them in can never
    // reach a street
    this.models = [...doc.models].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    this.#byId = new Map(this.models.map((model) => [model.id, model]))

    const buckets = new Map<string, ModelSpec[]>()
    for (const model of this.models) {
      const key = bucketKey(model)
      const found = buckets.get(key)
      if (found) found.push(model)
      else buckets.set(key, [model])
    }
    this.#byBucket = buckets
  }

  /** Reads a manifest. Anything that is not one comes back as a violation list. */
  static parse(value: unknown): Catalogue {
    const parsed = catalogueContract.parse(value)
    if (!parsed.ok) throw new InvalidCatalogue(parsed.error)
    return new Catalogue(parsed.value)
  }

  model(id: string): ModelSpec | undefined {
    return this.#byId.get(id)
  }

  /** Every model that fits this shape, in id order. */
  bucket(bucket: Bucket): readonly ModelSpec[] {
    return this.#byBucket.get(bucketKey(bucket)) ?? []
  }

  /**
   * The building this plot gets. Same plot, same answer, forever: the draw
   * hangs off the plot's own id, kind and style and takes nothing from a shared
   * stream, so dressing one plot cannot move another.
   *
   * Undefined when the catalogue has nothing this shape, which is the signal to
   * let the kit answer instead.
   */
  design(plot: Plot, size: { width: number; depth: number }): Design | undefined {
    const members = this.bucket(bucketOf(plot, size))
    if (members.length === 0) return undefined

    // a house, a chapel and a bar on one footprint should not be the same
    // building; where nothing in the bucket claims the trade, the whole bucket
    // answers rather than leaving the plot bare
    const suited = members.filter((model) => model.kinds.includes(plot.kind))
    const candidates = suited.length > 0 ? suited : members

    const rng = new Rng(`prefab/${plot.id}/${plot.kind}/${plot.style}`)
    return {
      model: rng.fork('model').pick(candidates).id,
      mirror: rng.fork('mirror').chance(0.5),
      rooms: rng.fork('rooms').int(0, ROOM_SHIFTS),
    }
  }

  /** Whether every shape asked for is in the catalogue. */
  covers(demand: Iterable<Bucket>): { ok: true } | Uncovered {
    const missing: Bucket[] = []
    const seen = new Set<string>()
    for (const bucket of demand) {
      const key = bucketKey(bucket)
      if (seen.has(key)) continue
      seen.add(key)
      if (this.bucket(bucket).length === 0) missing.push(bucket)
    }
    return missing.length === 0 ? { ok: true } : { ok: false, missing }
  }

  /** Every trade the catalogue can answer for, on every shape it holds. */
  kindsCovered(): readonly BuildingKind[] {
    const kinds = new Set<BuildingKind>()
    for (const model of this.models) for (const kind of model.kinds) kinds.add(kind)
    return [...kinds]
  }
}
