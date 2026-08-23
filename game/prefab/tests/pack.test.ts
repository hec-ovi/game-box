import { Forge, OfflineNarrator } from '@gb/forge'
import { storeyHeight } from '@gb/scene'
import { BUILDING_KINDS } from '@gb/world'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bucketKey, bucketOf, everyBucket } from '../src/bucket.ts'
import { Catalogue } from '../src/catalogue.ts'
import { sha256 } from '../src/digest.ts'
import { DOOR_FINISH, OPEN_DOOR_FINISH } from '../src/entrance.ts'
import { windowsOn } from '../src/interior.ts'
import { ROOM_BANKS, ROOM_PICTURES, ROOM_SIZE } from '../src/rooms.ts'
import { DISPLAY_FINISH, SCREEN_PICTURES, SCREEN_SIZE } from '../src/screens.ts'
import { io } from '../tools/intake.ts'
import { verifyPack } from '../tools/verify.ts'

const pack = new URL('../pack/', import.meta.url)
const document = new Uint8Array(readFileSync(new URL('buildings.json', pack)))
const manifest = JSON.parse(new TextDecoder().decode(document)) as unknown
const mesh = new Uint8Array(readFileSync(new URL('buildings.glb', pack)))
const strip = new Uint8Array(readFileSync(new URL('buildings-rooms.png', pack)))
const screens = new Uint8Array(readFileSync(new URL('buildings-screens.png', pack)))
const catalogue = Catalogue.parse(manifest)

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
    expect(catalogue.atlas.finishes.filter((finish) => windowsOn(finish))).toEqual(['a:facade', 'b:facade', 'c:facade', 'd:facade', 'glass'])
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
    await verifyPack(mesh, new Map(catalogue.models.map((model) => [model.id, model])))
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

  it('is drawn at the heights the city places plots at', () => {
    for (const model of catalogue.models) expect(storeyHeight(model.storeys)).toBe(4 + (model.storeys - 1) * 3.2)
  })
})
