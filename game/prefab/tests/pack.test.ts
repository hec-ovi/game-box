import { Forge, OfflineNarrator } from '@gb/forge'
import { storeyHeight } from '@gb/scene'
import { BUILDING_KINDS } from '@gb/world'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bucketKey, bucketOf, everyBucket } from '../src/bucket.ts'
import { Catalogue } from '../src/catalogue.ts'
import { io } from '../tools/intake.ts'
import { verifyPack } from '../tools/verify.ts'

const pack = new URL('../pack/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('buildings.json', pack), 'utf8')) as unknown
const mesh = new Uint8Array(readFileSync(new URL('buildings.glb', pack)))
const catalogue = Catalogue.parse(manifest)

describe('the shipped pack', () => {
  it('is the file its manifest describes', () => {
    expect(createHash('sha256').update(mesh).digest('hex')).toBe(catalogue.sha256)
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
