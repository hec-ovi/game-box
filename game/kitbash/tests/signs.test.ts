import { BUILDING_KINDS, METRICS, type BuildingKind } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { cellAt, cellUv, GLYPH_KEYS, KitDressing, nightLook, placeholderKit, SIGN, SIGN_ATTRIBUTES, signsFor, SOLID, TONES } from '../src/index.ts'
import { fingerprint, plotOf, signMesh, sizeOf, wallBounds } from './support.ts'

const kit = placeholderKit()
const dressing = new KitDressing(kit)

const heightOf = (storeys: number) => METRICS.building.groundFloorHeight + (storeys - 1) * METRICS.building.storeyHeight

/** A plot of a kind, with a name of its own, standing on a street to the south. */
function place(kind: BuildingKind, name: string, storeys = 3, at = 4): ReturnType<typeof plotOf> {
  return plotOf({ kind, name, storeys, rect: { x: at, y: at, w: 3, h: 3 }, entrance: { cell: { x: at + 1, y: at + 3 }, facing: 'south' } })
}

/** What the signs on a building actually spell, read back off the geometry. */
function readSigns(building: THREE.Object3D): string {
  const mesh = signMesh(building)
  if (!mesh) return ''
  const uv = mesh.geometry.getAttribute('uv')
  const cells: string[] = []
  for (let quad = 0; quad * 4 < uv.count; quad++) {
    const cell = cellAt(uv.getX(quad * 4), uv.getY(quad * 4))
    if (cell && cell !== SOLID) cells.push(cell)
  }
  return cells.join('')
}

describe('signs', () => {
  it('writes the building its own name over its door', () => {
    const anchor = place('bar', 'The Rusty Anchor')

    expect(readSigns(dressing.building(anchor, sizeOf(anchor, heightOf(3))))).toContain('THE RUSTY ANCHOR')
    // and it is the plot's name, not a fixture: rename the place and the wall changes
    const other = place('bar', 'Kettle & Coil')
    expect(readSigns(dressing.building(other, sizeOf(other, heightOf(3))))).toContain('KETTLE & COIL')
  })

  it('spells out what kind of place it is where the trade shouts', () => {
    const hotel = place('hotel', 'Marlow House')
    // the blade carries the trade, which is the wayfinding: name over the door, trade down the wall
    expect(readSigns(dressing.building(hotel, sizeOf(hotel, heightOf(5))))).toContain('HOTEL')
  })

  it('gives every building a sign and only the loud ones a wall full of them', () => {
    const counts = new Map<BuildingKind, number>()
    for (const kind of BUILDING_KINDS) {
      const plot = place(kind, 'Somewhere Or Other', 4)
      const signs = signsFor(plot, sizeOf(plot, heightOf(4)))
      expect(signs.length, kind).toBeGreaterThan(0)
      counts.set(kind, signs.length)
    }
    expect(counts.get('bar')!).toBeGreaterThan(counts.get('house')!)
    expect(counts.get('restaurant')!).toBeGreaterThan(counts.get('chapel')!)
  })

  it('draws every sign in the city with one material, so the lot is one draw', () => {
    const materials = new Set<THREE.Material>()
    const shapes = new Set<string>()
    for (let at = 0; at < 24; at++) {
      const plot = place(BUILDING_KINDS[at % BUILDING_KINDS.length]!, `Number ${at} Street`, 2 + (at % 5))
      const mesh = signMesh(dressing.building(plot, sizeOf(plot, heightOf(2 + (at % 5)))))
      if (!mesh) continue
      materials.add(mesh.material as THREE.Material)
      shapes.add(Object.keys(mesh.geometry.attributes).sort().join(','))
      // a batch only takes indexed, single-material meshes
      expect(mesh.geometry.getIndex(), plot.id).not.toBeNull()
      expect(Array.isArray(mesh.material)).toBe(false)
    }
    expect(materials.size, 'one material however many buildings there are').toBe(1)
    expect(shapes.size, 'and one set of attributes, so they all share one buffer').toBe(1)
    expect([...shapes][0]).toBe(['position', 'normal', 'uv', SIGN_ATTRIBUTES.ink, SIGN_ATTRIBUTES.panel, SIGN_ATTRIBUTES.glow].sort().join(','))
  })

  it('hangs nothing further off the wall than it says, or over the parapet', () => {
    for (const kind of BUILDING_KINDS) {
      for (const storeys of [1, 3, 6]) {
        const plot = place(kind, 'The Long Way Round', storeys)
        const size = sizeOf(plot, heightOf(storeys))
        const building = dressing.building(plot, size)
        const walls = wallBounds(building)
        const mesh = signMesh(building)
        if (!mesh) continue

        const box = new THREE.Box3().setFromObject(mesh)
        const past = SIGN.stand + SIGN.reach + 1e-6
        expect(box.min.x, `${kind} ${storeys}`).toBeGreaterThanOrEqual(walls.min.x - past)
        expect(box.max.x, `${kind} ${storeys}`).toBeLessThanOrEqual(walls.max.x + past)
        expect(box.min.z, `${kind} ${storeys}`).toBeGreaterThanOrEqual(walls.min.z - past)
        expect(box.max.z, `${kind} ${storeys}`).toBeLessThanOrEqual(walls.max.z + past)
        // nothing on the roof and nothing in the pavement
        expect(box.max.y, `${kind} ${storeys}`).toBeLessThanOrEqual(size.height + 1e-6)
        expect(box.min.y, `${kind} ${storeys}`).toBeGreaterThan(0)
      }
    }
  })

  it('puts the same signs on the same plot every run', () => {
    const plot = place('restaurant', 'Two Lanterns', 4)
    const size = sizeOf(plot, heightOf(4))
    const again = new KitDressing(placeholderKit())

    expect(signsFor(plot, size)).toEqual(signsFor(plot, size))
    expect(fingerprint(again.building(plot, size))).toBe(fingerprint(dressing.building(plot, size)))
    // a different place is different signage, so this is not passing on an empty wall
    const other = place('cafe', 'Ashgate Kitchen', 4)
    expect(signsFor(other, size)).not.toEqual(signsFor(plot, size))
  })

  it('is dark at noon and burns after it', () => {
    // the whole switch is the city's night level, so a sign cannot glow in daylight
    expect(nightLook(12).level).toBe(0)
    expect(nightLook(22).level).toBe(1)
    expect(reaches(emissiveOf(kit.material(SIGN.material)), kit.night.level), 'the emissive is wired to the clock').toBe(true)
  })

  it('holds a cell for every letter it can write', () => {
    for (const key of GLYPH_KEYS) {
      const [u0, v0, u1, v1] = cellUv(key)
      expect(cellAt((u0 + u1) / 2, (v0 + v1) / 2), key).toBe(key)
    }
  })
})

describe('the tone of the town', () => {
  it('takes a neon city down to near black and leaves a farming one alone', () => {
    const brick = Object.values(TONES).map((look) => value(look.tint.MI_RedBrick!))
    const neon = value(TONES.neon.tint.MI_RedBrick!)
    expect(neon, 'a neon facade is the nearest of the seven to a silhouette').toBe(Math.min(...brick))
    expect(neon * 2, 'and it is far under the brightest of them').toBeLessThan(Math.max(...brick))
    // and the parts of a facade stay apart, or the building is one flat fill
    const tints = Object.values(TONES.neon.tint).map(value)
    expect(Math.max(...tints) - Math.min(...tints)).toBeGreaterThan(0.05)
  })

  it('dresses the kit\'s own materials rather than replacing them', () => {
    const dressed = placeholderKit('coastal harbour town')
    const dark = placeholderKit('neon downtown')
    const brick = (library: ReturnType<typeof placeholderKit>) => (library.material('MI_RedBrick') as THREE.Material).name

    expect(brick(dressed)).toBe('MI_RedBrick')
    expect(brick(dark)).toBe('MI_RedBrick')
    expect(dressed.material('MI_RedBrick')).not.toBe(dark.material('MI_RedBrick'))
  })
})

/** How light a packed colour is, on the 0 to 1 scale it was authored on. */
function value(hex: number): number {
  return Math.max((hex >> 16) & 255, (hex >> 8) & 255, hex & 255) / 255
}

function emissiveOf(material: THREE.Material): unknown {
  return (material as unknown as { emissiveNode: unknown }).emissiveNode
}

/** Whether a node's graph reaches another node: the mutation check on a wiring. */
function reaches(from: unknown, target: unknown): boolean {
  const seen = new Set<unknown>()
  const queue = [from]
  while (queue.length > 0) {
    const node = queue.shift()
    if (!node || seen.has(node)) continue
    if (node === target) return true
    seen.add(node)
    const children = (node as { getChildren?: () => Iterable<unknown> }).getChildren
    if (typeof children === 'function') queue.push(...children.call(node))
  }
  return false
}
