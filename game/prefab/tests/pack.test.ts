import { Forge, OfflineNarrator } from '@gb/forge'
import { storeyHeight } from '@gb/scene'
import { BUILDING_KINDS } from '@gb/world'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { bucketKey, bucketOf, everyBucket } from '../src/bucket.ts'
import { Catalogue } from '../src/catalogue.ts'
import { sha256 } from '../src/digest.ts'
import { DOOR_FINISH, OPEN_DOOR_FINISH } from '../src/entrance.ts'
import { windowsOn } from '../src/interior.ts'
import { ROOM_BANKS, ROOM_PICTURES, ROOM_SIZE } from '../src/rooms.ts'
import { DISPLAY_FINISH, SCREEN_PICTURES, SCREEN_SIZE } from '../src/screens.ts'
import { DOOR, doorTile } from '../tools/doors.ts'
import { io } from '../tools/intake.ts'
import { wallFinish } from '../tools/layers.ts'
import { loadLooks } from '../tools/look.ts'
import { verifyPack } from '../tools/verify.ts'

const pack = new URL('../pack/', import.meta.url)
const document = new Uint8Array(readFileSync(new URL('buildings.json', pack)))
const manifest = JSON.parse(new TextDecoder().decode(document)) as unknown
const mesh = new Uint8Array(readFileSync(new URL('buildings.glb', pack)))
const strip = new Uint8Array(readFileSync(new URL('buildings-rooms.png', pack)))
const screens = new Uint8Array(readFileSync(new URL('buildings-screens.png', pack)))
const catalogue = Catalogue.parse(manifest)
const looks = loadLooks(new URL('../looks/', import.meta.url).pathname)

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
    const pictures = [...new Set(looks.map((look) => look.facade))]
    expect(catalogue.atlas.finishes.filter((finish) => windowsOn(finish))).toEqual([...pictures.map(wallFinish), 'glass'])
    expect(catalogue.atlas.finishes).toContain(DISPLAY_FINISH)
    expect(windowsOn(DISPLAY_FINISH)).toBeUndefined()
    for (const finish of [DOOR_FINISH, OPEN_DOOR_FINISH]) {
      expect(catalogue.atlas.finishes).toContain(finish)
      expect(windowsOn(finish)).toBeUndefined()
    }
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

  it('lays every screen panel out inside one picture, so a plot picks one screen for the whole of it', async () => {
    const doc = await io.readBinary(mesh)
    const wearing = catalogue.atlas.finishes.indexOf(DISPLAY_FINISH)
    let panels = 0
    let out = 0
    for (const primitive of doc.getRoot().listMeshes().flatMap((one) => one.listPrimitives())) {
      const layers = primitive.getAttribute('_LAYER')!
      const uvs = primitive.getAttribute('TEXCOORD_0')!
      const point: number[] = []
      for (let i = 0; i < layers.getCount(); i++) {
        if (Math.round(layers.getScalar(i)) !== wearing) continue
        panels++
        uvs.getElement(i, point)
        // the runtime slides a whole number of pictures onto this, and reads
        // the whole number back to pick which screen the panel carries. A uv
        // outside one picture would tear a second screen across the panel
        if (point[0]! < -0.01 || point[0]! > 1.01) out++
      }
    }
    expect({ panels: panels > 0, out }).toEqual({ panels: true, out: 0 })
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

  it('gives every trade something on every shape', () => {
    const kinds = catalogue.kindsCovered()
    expect([...kinds].sort()).toEqual([...BUILDING_KINDS].sort())
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
