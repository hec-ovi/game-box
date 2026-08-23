import { existsSync } from 'node:fs'
import { METRICS, type AnchorKind, type FurnitureProp } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { FurnishDressing, PROP_ART, placeholderFurnish } from '../src/index.ts'
import { KIT_FILE, loadPackedFurnish } from './pack.ts'
import { plates, town } from './support.ts'

/**
 * The height promise: wherever an anchor puts a body against a piece of
 * furniture, the surface the body meets is drawn where the body expects it.
 *
 * This is what floating forearms look like as a number. A bartender leans on a
 * counter that `@gb/cast`'s clip holds them at, a diner's weight lands on a
 * seat, a sleeper on a mattress: get the drawn height wrong and the limb hangs
 * in the air, and nothing else in the pipeline measures it.
 */

/** Anchor kinds where a body touches the furniture, rather than standing near it. */
const TOUCHING: readonly AnchorKind[] = ['sit', 'sit-drink', 'serve', 'cook', 'work-desk', 'sleep', 'lean']

/** How far off the mark a drawn surface may land. Quantising the packed mesh costs a millimetre. */
const TOLERANCE = 0.02

/** Every prop some anchor in a real town puts a body against, and what it puts them there to do. */
async function touched(): Promise<Map<FurnitureProp, Set<AnchorKind>>> {
  const world = await town()
  const found = new Map<FurnitureProp, Set<AnchorKind>>()
  for (const interior of world.interiors()) {
    const props = new Map(interior.furniture.map((piece) => [piece.id, piece.prop]))
    for (const anchor of interior.anchors) {
      const prop = anchor.propId === undefined ? undefined : props.get(anchor.propId)
      if (!prop || !TOUCHING.includes(anchor.kind)) continue
      found.set(prop, (found.get(prop) ?? new Set()).add(anchor.kind))
    }
  }
  return found
}

describe('the height a body meets', () => {
  it('is declared for every prop a real town sits, sleeps, serves or works at', async () => {
    const used = await touched()
    expect(used.size).toBeGreaterThan(4)

    for (const [prop, kinds] of used) {
      expect(PROP_ART[prop].contact, `${prop}, where somebody ${[...kinds].join(' and ')}s`).toBeDefined()
    }
  })

  it('is the height the metric names wherever the metric names one', () => {
    const { barCounterHeight, tableHeight, stoolHeight } = METRICS.furniture

    expect(PROP_ART['bar-counter'].contact?.height).toBe(barCounterHeight)
    expect(PROP_ART.table.contact?.height).toBe(tableHeight)
    expect(PROP_ART.desk.contact?.height).toBe(tableHeight)
    expect(PROP_ART['bar-stool'].contact?.height).toBe(stoolHeight)
  })

  it('comes out of the placeholder art on the mark', () => {
    const dressing = new FurnishDressing(placeholderFurnish())
    for (const [prop, art] of Object.entries(PROP_ART) as [FurnitureProp, (typeof PROP_ART)[FurnitureProp]][]) {
      if (!art.contact) continue
      expect(surfaceAt(dressing.prop(prop), art.contact.height), prop).toBeGreaterThan(0)
    }
  })
})

// the pack arrives with tools/build-kit.ts; without it there is nothing to measure
const packed = existsSync(KIT_FILE)
const kit = packed ? await loadPackedFurnish() : undefined
const shipped = kit ? new FurnishDressing(kit) : undefined

describe.skipIf(!packed)('the shipped pack', () => {
  it('draws a surface where the anchor and its clip expect one', async () => {
    for (const prop of (await touched()).keys()) {
      const want = PROP_ART[prop].contact!.height
      const object = shipped!.prop(prop)

      // what the library says, and then the object itself, which is the one that gets drawn
      expect(kit!.contact(prop), `${prop} claims its surface`).toBeCloseTo(want, 2)
      expect(surfaceAt(object, want), `${prop} has ${want} m of surface drawn on it`).toBeGreaterThan(0.02)
      expect(clearAbove(object, want), `${prop} has nothing broad standing over ${want} m`).toBe(true)
    }
  })

  it('puts the surface below the top of the piece, where a backrest or a headboard has one', () => {
    for (const prop of ['chair', 'office-chair', 'sofa', 'bed', 'bar-stool'] as const) {
      const height = new THREE.Box3().setFromObject(shipped!.prop(prop)).max.y

      expect(kit!.contact(prop), `${prop} sits below its own top`).toBeLessThan(height - 0.05)
    }
  })
})

/** How much level surface a built prop has at one height, in square metres. */
function surfaceAt(object: THREE.Object3D, height: number): number {
  let area = 0
  for (const plate of plates(object)) if (Math.abs(plate.y - height) <= TOLERANCE) area += plate.area
  return area
}

/**
 * Whether the piece is open above that height: nothing level and broad enough
 * to be the real surface stands over it. A seat with a table top above it is a
 * prop measured off the wrong plate.
 */
function clearAbove(object: THREE.Object3D, height: number): boolean {
  const box = new THREE.Box3().setFromObject(object)
  const footprint = (box.max.x - box.min.x) * (box.max.z - box.min.z)
  const below = surfaceAt(object, height)
  for (const plate of plates(object)) {
    if (plate.y <= height + TOLERANCE) continue
    if (plate.area >= 0.25 * footprint && plate.area > below) return false
  }
  return true
}
