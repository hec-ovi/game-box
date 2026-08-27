import { contract, Rng, type SchemaViolation } from '@gb/kit'
import type { AssetPackRef, Plot, ResolvedCharter } from '@gb/world'
import { z } from 'zod'
import { bucketKey, bucketOf, type Bucket } from './bucket.ts'
import { sha256 } from './digest.ts'

/**
 * How many places along a wall a plot's rooms can start. Enough that a street
 * of one model is a street of different rooms, small enough that the uv stays
 * far inside what a float carries a picture's worth of precision over.
 */
const ROOM_SHIFTS = 48

/**
 * What a tag looks like: the same word shape `@gb/world` writes a charter's
 * `suits` in, so a look and a charter can only ever meet on a word both could
 * have written. Membership is not checked here. What kinds of place exist is
 * the world file's to say, and a pack that refused a word it had not heard of
 * would drop a whole city to the kit over one institutional look.
 */
export const TAG = /^[a-z][a-z0-9-]{0,23}$/

/** The tags a plot's charter says a look may match: `ResolvedCharter.suits`. */
export type Suits = readonly string[]

const ModelSchema = z.object({
  /** `<look>-<front>x<depth>x<storeys>`. */
  id: z.string().min(1),
  look: z.string().min(1),
  front: z.number().positive(),
  depth: z.number().positive(),
  storeys: z.number().int().positive(),
  /** What this look suits, matched against a charter's `suits`. The pick filters on it before it draws. */
  tags: z.array(z.string().regex(TAG)).min(1),
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

/**
 * The relief strip, which carries one number per layer as well as its pixels:
 * the mean roughness of that finish. A shell reads no texture behind its wall,
 * so that float is how a far glazed tile stays glass and a far concrete wall
 * stays concrete.
 */
const ReliefSchema = StripSchema.extend({
  roughness: z.array(z.number().min(0).max(1)).min(1),
})

const layer = z.number().int().nonnegative()
const BankSchema = z.object({ first: layer, count: z.number().int().positive() })
const BanksSchema = z.object({ upper: BankSchema, street: BankSchema })

/**
 * The strip every window in the city reads, and how the theme pack that built
 * it laid the layers out: which run is back walls, which is flat panels, and
 * where the four faces a marched room shares sit. The runtime reads its layout
 * off this rather than assuming one, so a pack with its own pictures needs no
 * code.
 */
const GlazingSchema = StripSchema.extend({
  rooms: BanksSchema,
  panels: BanksSchema,
  faces: z.object({ floor: layer, ceiling: layer, side: layer, sideAlt: layer }),
}).superRefine((strip, ctx) => {
  const over = (at: number) => at >= strip.layers
  for (const [field, banks] of [
    ['rooms', strip.rooms],
    ['panels', strip.panels],
  ] as const) {
    for (const [bank, run] of Object.entries(banks)) {
      if (over(run.first + run.count - 1)) ctx.addIssue({ code: 'custom', path: [field, bank], message: `runs past the ${strip.layers} layers the strip has` })
    }
  }
  for (const [face, at] of Object.entries(strip.faces)) {
    if (over(at)) ctx.addIssue({ code: 'custom', path: ['faces', face], message: `layer ${at} is past the ${strip.layers} the strip has` })
  }
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
    /** Everything a window in the city can show: back walls, flat panels and the faces a room shares. */
    rooms: GlazingSchema,
    /** The pictures every screen in the city carries. */
    screens: StripSchema,
    /**
     * How every finish is shaped, how rough it is and where its hollows are.
     * Optional, because a pack baked before it existed still loads and draws
     * every wall at one roughness, which is what it always did.
     */
    relief: ReliefSchema.optional(),
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

export interface Unsuited {
  readonly ok: false
  /** The words no look in the pack claims, so their plots draw from the whole shape. */
  readonly missing: readonly string[]
}

export class InvalidCatalogue extends Error {
  readonly code = 'invalid-catalogue'
  readonly violations: readonly SchemaViolation[]

  constructor(violations: readonly SchemaViolation[]) {
    super(`prefab catalogue rejected: ${violations.map((v) => `${v.path} ${v.message}`).join('; ')}`)
    this.name = 'InvalidCatalogue'
    this.violations = violations
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
  /** SHA-256 of the mesh file. What the loader checks the committed bytes against. */
  readonly sha256: string
  /**
   * What this pack is, as a world file records it. The hash is the manifest's
   * own, which covers the five binaries through the hashes it lists, so one
   * string answers "is the reader's art the art this city was drawn with".
   * There is no hash when the manifest was handed over as a parsed value
   * rather than as bytes, which is the honest answer: nothing was read.
   */
  readonly identity: AssetPackRef
  readonly atlas: CatalogueDoc['atlas']
  readonly models: readonly ModelSpec[]
  readonly #byId: ReadonlyMap<string, ModelSpec>
  readonly #byBucket: ReadonlyMap<string, readonly ModelSpec[]>

  private constructor(doc: CatalogueDoc, manifest?: string) {
    this.pack = doc.pack
    this.version = doc.version
    this.sha256 = doc.sha256
    this.identity = manifest ? { pack: doc.pack, version: doc.version, sha256: manifest } : { pack: doc.pack, version: doc.version }
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

  /**
   * The same, off the manifest's own bytes, so the catalogue can say which pack
   * it is. Whoever pins a city's plots writes `identity` into the world file
   * beside them.
   */
  static async read(manifest: ArrayBuffer | Uint8Array): Promise<Catalogue> {
    // copied into a plain buffer so the digest takes it whatever the caller
    // read the file with, and so nothing can edit it under the hash
    const bytes: Uint8Array<ArrayBuffer> = manifest instanceof Uint8Array ? Uint8Array.from(manifest) : new Uint8Array(manifest)
    let document: unknown
    try {
      document = JSON.parse(new TextDecoder().decode(bytes))
    } catch (cause) {
      throw new InvalidCatalogue([{ path: '', message: `not JSON: ${(cause as Error).message}` }])
    }
    const parsed = catalogueContract.parse(document)
    if (!parsed.ok) throw new InvalidCatalogue(parsed.error)
    return new Catalogue(parsed.value, await sha256(bytes))
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
   * `suits` is what the plot's charter says a look may match, and a look is
   * suited when it shares a tag with it. Undefined when the catalogue has
   * nothing this shape, which is the signal to let the kit answer instead.
   */
  design(plot: Plot, size: { width: number; depth: number }, suits: Suits): Design | undefined {
    const members = this.bucket(bucketOf(plot, size))
    if (members.length === 0) return undefined

    // a house, a chapel and a bar on one footprint should not be the same
    // building; where nothing in the bucket claims the charter, the whole
    // bucket answers rather than leaving the plot bare
    const suited = members.filter((model) => claims(model, suits))
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

  /** Whether every charter asked for has a look that claims it. Every look is baked at every shape, so the pack answers for all of them at once. */
  suits(charters: Iterable<Pick<ResolvedCharter, 'word' | 'suits'>>): { ok: true } | Unsuited {
    const missing: string[] = []
    for (const charter of charters) {
      if (!this.models.some((model) => claims(model, charter.suits))) missing.push(charter.word)
    }
    return missing.length === 0 ? { ok: true } : { ok: false, missing }
  }
}

function claims(model: ModelSpec, suits: Suits): boolean {
  return model.tags.some((tag) => suits.includes(tag))
}
