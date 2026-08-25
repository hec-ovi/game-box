import { Forge, OfflineNarrator } from '@gb/forge'
import { storeyHeight } from '@gb/scene'
import { SHIPPED_CHARTERS } from '@gb/world'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { BALCONY } from '../src/balcony.ts'
import { bucketKey, bucketOf, everyBucket } from '../src/bucket.ts'
import { Catalogue } from '../src/catalogue.ts'
import { sha256 } from '../src/digest.ts'
import { DOOR_FINISH, OPEN_DOOR_FINISH } from '../src/entrance.ts'
import { PROUD } from '../src/fit.ts'
import { windowsOn } from '../src/windows.ts'
import { ROOM_BANKS, ROOM_PICTURES, ROOM_SIZE } from '../src/rooms.ts'
import { DISPLAY_FINISH, SCREEN_PICTURES, SCREEN_SIZE } from '../src/screens.ts'
import { DOOR, doorTile } from '../tools/doors.ts'
import { io } from '../tools/intake.ts'
import { baseFinish, stretchOf, wallFinish } from '../src/wall.ts'
import { loadLooks } from '../tools/look.ts'
import { CLEAR } from '../tools/stack.ts'
import { verifyPack } from '../tools/verify.ts'
import { plotOf } from './support.ts'

const pack = new URL('../pack/', import.meta.url)
const document = new Uint8Array(readFileSync(new URL('buildings.json', pack)))
const manifest = JSON.parse(new TextDecoder().decode(document)) as unknown
const mesh = new Uint8Array(readFileSync(new URL('buildings.glb', pack)))
const strip = new Uint8Array(readFileSync(new URL('buildings-rooms.png', pack)))
const screens = new Uint8Array(readFileSync(new URL('buildings-screens.png', pack)))
const colour = new Uint8Array(readFileSync(new URL('buildings-colour.png', pack)))
const catalogue = Catalogue.parse(manifest)
const looks = loadLooks(new URL('../looks/', import.meta.url).pathname)
const pictures = [...new Set(looks.map((look) => look.facade))]

/** Every model in the pack, in metres, with each vertex's layer name. */
async function models(): Promise<Array<{ id: string; storeys: number; vertices: Array<{ x: number; y: number; z: number; u: number; v: number; finish: string }> }>> {
  const doc = await io.readBinary(mesh)
  const out = []
  for (const node of doc.getRoot().listNodes()) {
    const geometry = node.getMesh()
    const model = catalogue.model(node.getName())
    if (!geometry || !model) continue
    const scale = node.getScale()
    const lift = node.getTranslation()
    const vertices = []
    for (const primitive of geometry.listPrimitives()) {
      const positions = primitive.getAttribute('POSITION')!
      const uvs = primitive.getAttribute('TEXCOORD_0')!
      const layers = primitive.getAttribute('_LAYER')!
      const point: number[] = []
      const at: number[] = []
      for (let i = 0; i < positions.getCount(); i++) {
        positions.getElement(i, point)
        uvs.getElement(i, at)
        vertices.push({
          x: point[0]! * scale[0]! + lift[0]!,
          y: point[1]! * scale[1]! + lift[1]!,
          z: point[2]! * scale[2]! + lift[2]!,
          u: at[0]!,
          v: at[1]!,
          finish: catalogue.atlas.finishes[Math.round(layers.getScalar(i))]!,
        })
      }
    }
    out.push({ id: model.id, storeys: model.storeys, vertices })
  }
  return out
}

type Vertex = Awaited<ReturnType<typeof models>>[number]['vertices'][number]

/** The plates on the display layer, told apart by where they stand: the front face of each, and its extent. */
function plates(vertices: readonly Vertex[]): Array<{ low: number[]; high: number[]; u: number[]; v: number[] }> {
  const found = new Map<string, { low: number[]; high: number[]; u: number[]; v: number[] }>()
  for (const vertex of vertices) {
    if (vertex.finish !== DISPLAY_FINISH) continue
    // a banner stands on the street level and a board on a parapet storey, and no look carries two of either
    const key = vertex.y < 3.5 ? 'banner' : 'board'
    const plate = found.get(key) ?? { low: [Infinity, Infinity, Infinity], high: [-Infinity, -Infinity, -Infinity], u: [Infinity, -Infinity], v: [Infinity, -Infinity] }
    for (const [c, value] of [vertex.x, vertex.y, vertex.z].entries()) {
      plate.low[c] = Math.min(plate.low[c]!, value)
      plate.high[c] = Math.max(plate.high[c]!, value)
    }
    found.set(key, plate)
  }
  for (const plate of found.values()) {
    for (const vertex of vertices) {
      // the front face: the plate's own outermost z, where the picture is read
      if (vertex.finish !== DISPLAY_FINISH || vertex.z < plate.high[2]! - 0.001 || vertex.y < plate.low[1]! - 0.001 || vertex.y > plate.high[1]! + 0.001) continue
      plate.u = [Math.min(plate.u[0]!, vertex.u), Math.max(plate.u[1]!, vertex.u)]
      plate.v = [Math.min(plate.v[0]!, vertex.v), Math.max(plate.v[1]!, vertex.v)]
    }
  }
  return [...found.values()]
}

describe('the shipped pack', () => {
  it('is the file its manifest describes', () => {
    expect(createHash('sha256').update(mesh).digest('hex')).toBe(catalogue.sha256)
  })

  it('carries the rooms its manifest describes, one layer per committed picture', () => {
    expect(createHash('sha256').update(strip).digest('hex')).toBe(catalogue.atlas.rooms.sha256)
    expect(catalogue.atlas.rooms.layers).toBe(ROOM_PICTURES.length)
    expect(catalogue.atlas.rooms.size).toBe(ROOM_SIZE)
    for (const bank of Object.values(ROOM_BANKS)) expect(bank.first + bank.count).toBeLessThanOrEqual(ROOM_PICTURES.length)
  })

  it('carries the screens its manifest describes, one layer per composition', () => {
    expect(createHash('sha256').update(screens).digest('hex')).toBe(catalogue.atlas.screens.sha256)
    expect(catalogue.atlas.screens.layers).toBe(SCREEN_PICTURES.length)
    expect(catalogue.atlas.screens.size).toBe(SCREEN_SIZE)
  })

  it('names what every layer paints, and which of them have windows in them', () => {
    expect(catalogue.atlas.finishes).toHaveLength(catalogue.atlas.colour.layers)
    // one layer per committed wall picture, so a bar and a corporate slab are
    // not the same surface and two looks wearing one picture pay for it once.
    // Every one of them is a layer the shader cuts windows out of
    expect(catalogue.atlas.finishes.filter((finish) => windowsOn(finish))).toEqual([...pictures.map(wallFinish), 'glass'])
    expect(catalogue.atlas.finishes).toContain(DISPLAY_FINISH)
    expect(windowsOn(DISPLAY_FINISH)).toBeUndefined()
    for (const finish of [DOOR_FINISH, OPEN_DOOR_FINISH]) {
      expect(catalogue.atlas.finishes).toContain(finish)
      expect(windowsOn(finish)).toBeUndefined()
    }
  })

  it('lays every wall picture down twice, so the base under a look is that look at the same scale', async () => {
    const { data, info } = await sharp(Buffer.from(colour)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const size = catalogue.atlas.colour.size
    const layer = (finish: string) => {
      const index = catalogue.atlas.finishes.indexOf(finish)
      expect(index, finish).toBeGreaterThanOrEqual(0)
      return data.subarray(index * size * size * info.channels, (index + 1) * size * size * info.channels)
    }
    for (const picture of pictures) {
      expect(windowsOn(baseFinish(picture))).toBeUndefined()
      expect(Buffer.compare(layer(baseFinish(picture)), layer(wallFinish(picture))), picture).toBe(0)
    }
    // the producer tiles a base square by the metre and lays the wall over two
    // floors, so the shader stretches a base's v to the wall's own scale
    expect(stretchOf(baseFinish(pictures[0]!))).toBeCloseTo(12 / 6.42, 6)
    expect(stretchOf(wallFinish(pictures[0]!))).toBe(1)
    expect(catalogue.atlas.finishes.filter((finish) => !finish.startsWith('wall:') && !finish.startsWith('base:'))).toEqual([
      DOOR_FINISH,
      DISPLAY_FINISH,
      'glass',
      'neon:cyan',
      'neon:teal',
      'neon:magenta',
      'neon:amber',
      OPEN_DOOR_FINISH,
      BALCONY.finish,
    ])
  })

  it('says which pack it is, hashing the manifest that names every file in it', async () => {
    const read = await Catalogue.read(document)
    expect(read.identity).toEqual({ pack: read.pack, version: read.version, sha256: await sha256(document) })
    // the manifest's own hash, not the mesh's: the manifest carries the hash of
    // all five binaries, so one string answers whether a reader's art is the
    // art the city was drawn with, and a rebuilt atlas alone changes it
    expect(read.identity.sha256).not.toBe(read.sha256)
  })

  it('bakes nothing onto the entrance you can walk through, because the runtime is what puts a plot there', async () => {
    const doc = await io.readBinary(mesh)
    const plain = catalogue.atlas.finishes.indexOf(DOOR_FINISH)
    const opens = catalogue.atlas.finishes.indexOf(OPEN_DOOR_FINISH)
    let doors = 0
    let baked = 0
    for (const primitive of doc.getRoot().listMeshes().flatMap((one) => one.listPrimitives())) {
      const layers = primitive.getAttribute('_LAYER')!
      for (let i = 0; i < layers.getCount(); i++) {
        const wearing = Math.round(layers.getScalar(i))
        if (wearing === plain) doors++
        if (wearing === opens) baked++
      }
    }
    expect({ doors: doors > 0, baked }).toEqual({ doors: true, baked: 0 })
  })

  it('lays every screen panel out as exactly one picture, so the whole panel is the picture and a plot picks one screen for all of it', async () => {
    let panels = 0
    const wrong: string[] = []
    for (const model of await models()) {
      for (const plate of plates(model.vertices)) {
        panels++
        // the runtime slides a whole number of pictures onto this and reads the
        // whole number back to pick which screen the panel carries; the face
        // spans one picture each way, so the picture fills it edge to edge
        const spans = [plate.u[1]! - plate.u[0]!, plate.v[1]! - plate.v[0]!]
        if (Math.abs(spans[0]! - 1) > 0.01 || Math.abs(spans[1]! - 1) > 0.01 || plate.u[0]! < -0.01) {
          wrong.push(`${model.id}: u ${plate.u.map((v) => v.toFixed(3)).join('..')} v ${plate.v.map((v) => v.toFixed(3)).join('..')}`)
        }
      }
    }
    expect({ panels: panels > 100, wrong }).toEqual({ panels: true, wrong: [] })
  })

  it('keeps every advert at least one city cell clear of the door, sideways or above its head', async () => {
    const wrong: string[] = []
    let panels = 0
    for (const model of await models()) {
      const door = model.vertices.filter((vertex) => vertex.finish === DOOR_FINISH)
      const left = Math.min(...door.map((vertex) => vertex.x))
      const right = Math.max(...door.map((vertex) => vertex.x))
      const head = Math.max(...door.map((vertex) => vertex.y))
      for (const plate of plates(model.vertices)) {
        panels++
        const clear = CLEAR / 10
        const beside = plate.high[0]! <= left - clear || plate.low[0]! >= right + clear
        const above = plate.low[1]! >= head + clear
        if (!beside && !above) wrong.push(`${model.id}: plate x ${plate.low[0]!.toFixed(2)}..${plate.high[0]!.toFixed(2)} y from ${plate.low[1]!.toFixed(2)}, door x ${left.toFixed(2)}..${right.toFixed(2)} head ${head.toFixed(2)}`)
      }
    }
    expect({ panels: panels > 100, wrong }).toEqual({ panels: true, wrong: [] })
  })

  it('lights nothing beside a door: the only tube on a building is the one round its parapet', async () => {
    const wrong: string[] = []
    for (const model of await models()) {
      const lowest = Math.min(...model.vertices.filter((vertex) => vertex.finish.startsWith('neon:')).map((vertex) => vertex.y))
      if (lowest < storeyHeight(model.storeys) - PROUD - 0.2) wrong.push(`${model.id}: a tube from ${lowest.toFixed(2)} m`)
    }
    expect(wrong).toEqual([])
  })

  it('is one entrance in two states, so only the lobby tells the two doors apart', async () => {
    const [plain, open] = await Promise.all([doorTile('plain'), doorTile('open')])
    // at the plate's own size, so a resample cannot blur a rectangle's edge
    // into the frame and make a clean relight look like a second door
    const read = async (image: Uint8Array) => await sharp(Buffer.from(image)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const [dark, lit] = await Promise.all([read(plain.colour), read(open.colour)])
    const size = dark.info.width

    // everything the relight is allowed to touch: the glass, the threshold and
    // the reader's marks. A change anywhere else is two doors, not one door
    // twice, and the city would read as if half its entrances were a different
    // building
    const relit = (x: number, y: number) =>
      inside(x, y, DOOR.threshold, size) ||
      inside(x, y, DOOR.call, size) ||
      // the fanlight is one pane across the top; only the leaves under it are
      // split by the meeting stile, which is not glass and is never relit
      DOOR.glazing.some(
        (band, index) => inside(x, y, { ...DOOR.pane, ...band }, size) && !(index > 0 && inside(x, y, { ...DOOR.stile, ...band }, size)),
      )

    let outside = 0
    let changed = 0
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const at = (y * size + x) * 3
        const same = dark.data[at] === lit.data[at] && dark.data[at + 1] === lit.data[at + 1] && dark.data[at + 2] === lit.data[at + 2]
        if (same) continue
        if (relit(x, y)) changed++
        else outside++
      }
    }
    expect({ outside, lobbyChanged: changed > 20000 }).toEqual({ outside: 0, lobbyChanged: true })
  })

  it('carries an entrance that is the same both ways round, because half the city draws its model mirrored', async () => {
    const { data, info } = await sharp(new URL('../finishes/door.png', import.meta.url).pathname).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    let worst = 0
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width / 2; x++) {
        for (let c = 0; c < info.channels; c++) {
          const left = data[(y * info.width + x) * info.channels + c]!
          const right = data[(y * info.width + info.width - 1 - x) * info.channels + c]!
          worst = Math.max(worst, Math.abs(left - right))
        }
      }
    }
    expect(worst).toBe(0)
  })

  it('hangs a balcony on every upper storey of the looks that carry one, over the pavement, with a floor under its rails', async () => {
    const carrying = new Set(looks.filter((look) => look.balcony).map((look) => look.id))
    expect(carrying.size).toBeGreaterThan(0)
    const wrong: string[] = []
    let balconies = 0
    for (const model of await models()) {
      const rails = model.vertices.filter((vertex) => vertex.finish === BALCONY.finish)
      const look = catalogue.model(model.id)!.look
      if (!carrying.has(look) || model.storeys < 2) {
        if (rails.length) wrong.push(`${model.id}: a balustrade on a look without balconies`)
        continue
      }
      // one per upper storey: every rail vertex sits on a storey's floor or a guard's height above it
      const floors = new Set(rails.map((vertex) => Math.floor((vertex.y - BALCONY.above + 0.5) / 3.2))).size
      if (floors !== model.storeys - 1) wrong.push(`${model.id}: rails on ${floors} storeys of ${model.storeys - 1}`)
      balconies += floors
      // over the pavement and nowhere else, above head height, inside the reach the pavement allows.
      // A parapet storey stepped back off the street hangs its balcony off its own face
      const depth = catalogue.model(model.id)!.depth / 2
      const setback = looks.find((one) => one.id === look)?.setback ?? 0
      for (const vertex of rails) {
        if (vertex.z < depth - setback - 0.1 || vertex.z > depth + BALCONY.reach + 0.001 || vertex.y < BALCONY.above - 0.001) {
          wrong.push(`${model.id}: a rail at ${vertex.x.toFixed(2)}, ${vertex.y.toFixed(2)}, ${vertex.z.toFixed(2)}`)
          break
        }
      }
      // a floor the player can see: the slab is the look's own wall, standing out as far as the rails do
      const reach = Math.max(...rails.map((vertex) => vertex.z))
      if (!model.vertices.some((vertex) => vertex.finish.startsWith('base:') && Math.abs(vertex.z - reach) < 0.001)) wrong.push(`${model.id}: no slab under the rails`)
    }
    expect({ balconies: balconies > 200, wrong }).toEqual({ balconies: true, wrong: [] })
  })

  it('holds every model the manifest names, at the triangle count it claims', async () => {
    const doc = await io.readBinary(mesh)
    const built = new Map(
      doc
        .getRoot()
        .listMeshes()
        .map((one) => [one.getName(), one.listPrimitives().reduce((sum, prim) => sum + (prim.getIndices()?.getCount() ?? 0) / 3, 0)]),
    )
    for (const model of catalogue.models) expect(built.get(model.id), model.id).toBe(model.triangles)
  })

  it('stands every model exactly as tall as its plot, inside its footprint', async () => {
    await verifyPack(mesh, new Map(catalogue.models.map((model) => [model.id, model])), catalogue.atlas.finishes)
  })

  it('has a building for every shape the city can cut', () => {
    expect(catalogue.covers(everyBucket())).toEqual({ ok: true })
  })

  it('has a building for every plot the forge actually cuts', async () => {
    const shapes = new Set<string>()
    for (const seed of ['metro', 'kite', 'orbit']) {
      for (const maxStoreys of [3, 4]) {
        const forge = new Forge(new OfflineNarrator(seed))
        const built = await forge.build({ theme: 'a neon port city', seed, blocksX: 4, blocksY: 4, density: 1, maxStoreys })
        expect(built.ok).toBe(true)
        if (!built.ok) continue
        for (const plot of built.value.world.plots()) {
          const size = { width: plot.rect.w * built.value.world.cellSize, depth: plot.rect.h * built.value.world.cellSize }
          shapes.add(bucketKey(bucketOf(plot, size)))
        }
      }
    }

    const missing = [...shapes].filter((key) => !catalogue.models.some((model) => bucketKey(model) === key))
    expect({ missing, seen: shapes.size }).toEqual({ missing: [], seen: shapes.size })
    expect(shapes.size).toBeGreaterThan(20)
  })

  it('claims every preset charter, and an invented word by the tags its charter carries', () => {
    expect(catalogue.suits(SHIPPED_CHARTERS)).toEqual({ ok: true })
    const size = { width: 8, depth: 12 }
    const claimed = (design: { model: string } | undefined, suits: readonly string[]) => catalogue.model(design?.model ?? '')?.tags.some((tag) => suits.includes(tag))
    for (const charter of SHIPPED_CHARTERS) {
      expect(claimed(catalogue.design(plotOf({ kind: charter.word }), size, charter.suits), charter.suits), charter.word).toBe(true)
    }
    // a word no look has heard of, whose charter says it is a narrow painted bar
    const speakeasy = ['bar', 'narrow', 'painted', 'speakeasy']
    expect(catalogue.model(catalogue.design(plotOf({ kind: 'speakeasy' }), size, speakeasy)!.model)?.tags).toContain('bar')
    // and one nothing claims is named, so a pack can be asked before a city is built against it
    expect(catalogue.suits([{ word: 'vault', suits: ['sealed', 'vault'] }])).toEqual({ ok: false, missing: ['vault'] })
    for (const bucket of everyBucket()) {
      const looks = new Set(catalogue.bucket(bucket).map((model) => model.look))
      expect(looks.size, bucketKey(bucket)).toBeGreaterThanOrEqual(8)
    }
  })

  it('carries wall pictures that tile, because a seam repeats all the way up a building', async () => {
    const worst: Record<string, number> = {}
    for (const name of [...new Set(looks.map((look) => look.facade)), 'street-surround']) {
      const { data, info } = await sharp(new URL(`../finishes/${name}.png`, import.meta.url).pathname)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const at = (x: number, y: number, c: number) => data[(y * info.width + x) * info.channels + c]!
      const gap = (a: (i: number) => [number, number], b: (i: number) => [number, number], length: number) => {
        let sum = 0
        for (let i = 0; i < length; i++) {
          for (let c = 0; c < info.channels; c++) sum += Math.abs(at(...a(i), c) - at(...b(i), c))
        }
        return sum / (length * info.channels)
      }
      // the far edge against the near edge, measured against what one step
      // inside costs: a tile that wraps is no worse across the join than it is
      // anywhere else in the picture
      const across = gap((y) => [0, y], (y) => [info.width - 1, y], info.height) / Math.max(0.5, gap((y) => [0, y], (y) => [1, y], info.height))
      const down = gap((x) => [x, 0], (x) => [x, info.height - 1], info.width) / Math.max(0.5, gap((x) => [x, 0], (x) => [x, 1], info.width))
      worst[name] = +Math.max(across, down).toFixed(2)
    }
    for (const [name, ratio] of Object.entries(worst)) expect(ratio, `${name}: ${JSON.stringify(worst)}`).toBeLessThan(2)
  })

  it('is drawn at the heights the city places plots at', () => {
    for (const model of catalogue.models) expect(storeyHeight(model.storeys)).toBe(4 + (model.storeys - 1) * 3.2)
  })
})

/** A pixel inside a rectangle given in shares, rounded the way the painter rounds it. */
function inside(x: number, y: number, box: { x0: number; y0: number; x1: number; y1: number }, size: number): boolean {
  const at = (share: number) => Math.round(share * size)
  return x >= at(box.x0) && x < at(box.x1) && y >= at(box.y0) && y < at(box.y1)
}
