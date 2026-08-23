import { METRICS, type AnchorKind, type FurnitureProp } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { FURNISH_STYLES, PROP_SPECS } from '../src/index.ts'
import { contactOf, dressingIn, plates, town } from './support.ts'

/**
 * The height promise, and the reason furniture is generated at all.
 *
 * A body's clip is written against a number: the sitting clip puts hips 9 cm
 * over the seat, the lean clip puts hands just over the counter. Fitting a
 * model to that number leaves it near it; drawing the geometry at it leaves it
 * on it. So these tests carry no tolerance beyond what a float32 position
 * buffer can hold, and the last one proves that by breaking a prop and watching
 * the measurement catch it.
 */

/** Anchor kinds where a body touches the furniture rather than standing near it. */
const TOUCHING: readonly AnchorKind[] = ['sit', 'sit-drink', 'serve', 'cook', 'work-desk', 'sleep', 'lean']

/** Ten microns: float32's own precision at these sizes, not a tolerance. */
const EXACT = 5

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
      expect(PROP_SPECS[prop].contact, `${prop}, where somebody ${[...kinds].join(' and ')}s`).toBeDefined()
    }
  })

  it('is exactly the contract height on the drawn triangles, in both languages', () => {
    for (const style of FURNISH_STYLES) {
      const dressing = dressingIn(style)
      for (const [prop, spec] of Object.entries(PROP_SPECS) as [FurnitureProp, (typeof PROP_SPECS)[FurnitureProp]][]) {
        if (!spec.contact) continue
        const drawn = contactOf(dressing.prop(prop), spec.contact.kind)
        expect(drawn, `${style} ${prop}`).toBeCloseTo(spec.contact.height, EXACT)
      }
    }
  })

  it('comes from @gb/world, which is the one place those numbers live', () => {
    const metric = METRICS.furniture
    expect(PROP_SPECS['bar-counter'].contact?.height).toBe(metric.barCounterHeight)
    expect(PROP_SPECS['bar-counter'].staffContact).toBe(metric.serviceCounterHeight)
    expect(PROP_SPECS.counter.contact?.height).toBe(metric.serviceCounterHeight)
    expect(PROP_SPECS.table.contact?.height).toBe(metric.tableHeight)
    expect(PROP_SPECS.desk.contact?.height).toBe(metric.tableHeight)
    expect(PROP_SPECS['bar-stool'].contact?.height).toBe(metric.stoolHeight)
    expect(PROP_SPECS.chair.contact?.height).toBe(metric.seatHeight)
    expect(PROP_SPECS.bed.contact?.height).toBe(metric.mattressHeight)
    expect(PROP_SPECS.stove.contact?.height).toBe(metric.worktopHeight)
  })

  it('gives the bar counter a working shelf at service height as well as its rail', () => {
    // the raised rail is where a drink stands; the shelf behind it is where the
    // bartender's forearms land, and the lean clip holds hands at 1.02 to 1.04
    for (const style of FURNISH_STYLES) {
      const counter = dressingIn(style).prop('bar-counter')
      const staff = PROP_SPECS['bar-counter'].staffContact!
      const level = plates(counter).find((plate) => Math.abs(plate.y - staff) < 1e-5)

      expect(level, `${style} bar counter shelf at ${staff}`).toBeDefined()
      expect(level!.area, `${style} bar counter shelf`).toBeGreaterThan(0.25)
    }
  })

  it('would catch a prop drawn 5 mm off, which is what makes the numbers above worth reading', () => {
    const spec = PROP_SPECS.chair.contact!
    const chair = dressingIn('corpo').prop('chair') as THREE.Mesh
    const broken = new THREE.Mesh(chair.geometry.clone().translate(0, 0.005, 0), chair.material)

    expect(contactOf(chair, spec.kind)).toBeCloseTo(spec.height, EXACT)
    expect(() => expect(contactOf(broken, spec.kind)).toBeCloseTo(spec.height, EXACT)).toThrow()
    broken.geometry.dispose()
  })
})
