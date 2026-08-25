import { FURNITURE_PROPS, PROP_SPECS, footprintOf, type AnchorKind, type FurnitureProp } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { FURNISH_STYLES } from '../src/index.ts'
import { boundsOf, contactOf, dressingIn, interiorsAcrossTowns, plates } from './support.ts'

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

/**
 * Every prop a real town puts a body against, and what it puts them there to
 * do. The exact set, not a floor under it: a count says nothing when one prop
 * loses its body and another gains one, and a floor is a number somebody
 * lowers.
 *
 * A bar stool is deliberately absent. There is no clip that sits a body on a
 * raised seat, so `@gb/forge` sits drinkers on table chairs and a stool is a
 * piece a body walks round; it comes back carrying `sit-drink` the day
 * `@gb/cast` ships the pose, and this is where that is noticed. `lean` is
 * absent for a different reason: a leaning body is stationed at a spot on the
 * floor and names no prop at all.
 */
const TOUCHED: Partial<Record<FurnitureProp, readonly AnchorKind[]>> = {
  'bar-counter': ['serve'],
  bed: ['sleep'],
  chair: ['sit', 'sit-drink'],
  counter: ['serve'],
  'office-chair': ['work-desk'],
  sofa: ['sit'],
  stove: ['cook'],
}

/** Ten microns: float32's own precision at these sizes, not a tolerance. */
const EXACT = 5

/** Every prop some anchor in a real town puts a body against, and what it puts them there to do. */
async function touched(): Promise<Map<FurnitureProp, Set<AnchorKind>>> {
  const found = new Map<FurnitureProp, Set<AnchorKind>>()
  for (const interior of await interiorsAcrossTowns()) {
    const props = new Map(interior.furniture.map((piece) => [piece.id, piece.prop]))
    for (const anchor of interior.anchors) {
      const prop = anchor.propId === undefined ? undefined : props.get(anchor.propId)
      if (!prop || !TOUCHING.includes(anchor.kind)) continue
      found.set(prop, (found.get(prop) ?? new Set()).add(anchor.kind))
    }
  }
  return found
}

/** One readable line per prop, sorted, so a failure names what moved. */
function listed(pairs: Iterable<[string, Iterable<AnchorKind>]>): string[] {
  return [...pairs].map(([prop, kinds]) => `${prop}: ${[...kinds].sort().join(', ')}`).sort()
}

describe('the height a body meets', () => {
  it('is declared for every prop a real town sits, sleeps, serves or works at', async () => {
    const used = await touched()
    expect(listed(used)).toEqual(listed(Object.entries(TOUCHED)))

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

  it('gives the bar counter a working shelf at service height as well as its rail', () => {
    // the rail is where a drink stands; the shelf behind it is where the
    // bartender's forearms land, and the lean clip holds hands at 1.02 to 1.04
    for (const style of FURNISH_STYLES) {
      const counter = dressingIn(style).prop('bar-counter')
      const staff = PROP_SPECS['bar-counter'].staffContact!
      const level = plates(counter).find((plate) => Math.abs(plate.y - staff) < 1e-5)

      expect(level, `${style} bar counter shelf at ${staff}`).toBeDefined()
      expect(level!.area, `${style} bar counter shelf`).toBeGreaterThan(0.25)
    }
  })

  it('lifts a till and a coffee machine onto the drawn top of the counter they stand on', () => {
    // the planner writes `Furniture.lift` as the host's contact height and
    // `@gb/scene` draws the piece there: so the published number has to be the
    // drawn top, and the piece has to fit on it
    const lifted = FURNITURE_PROPS.filter((prop) => PROP_SPECS[prop].onSurface)
    expect(lifted).toEqual(['register', 'coffee-machine'])

    for (const style of FURNISH_STYLES) {
      const dressing = dressingIn(style)
      for (const host of ['counter', 'bar-counter'] as const) {
        const lift = dressing.contactHeight(host)!
        const top = plates(dressing.prop(host)).find((plate) => Math.abs(plate.y - lift) < 1e-5)
        expect(top, `${style} ${host} top at ${lift}`).toBeDefined()

        for (const prop of lifted) {
          const piece = dressing.prop(prop)
          piece.position.y = lift
          const bounds = boundsOf(piece)
          expect(bounds.min.y, `${style} ${prop} on the ${host}`).toBeCloseTo(top!.y, EXACT)
          expect(footprintOf(prop).depth, `${style} ${prop} fits the ${host}`).toBeLessThanOrEqual(footprintOf(host).depth)
        }
      }
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
