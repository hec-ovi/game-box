import { METRICS, SHIPPED_CHARTERS } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { cellAt, cellUv, DOORLAMP, DOORLIGHT, GLYPH_KEYS, KitDressing, LETTER_SHARE, lightsFor, luminanceOf, MODULE, NEON, nightLook, placeholderKit, SIGN, SIGN_ATTRIBUTES, signsFor, SOLID, TONES, TRANSIT, type Sign } from '../src/index.ts'
import { charterOf, fingerprint, inventedCharter, plotOf, signMesh, sizeOf, townOf, wallBounds } from './support.ts'

const kit = placeholderKit()
const dressing = new KitDressing(kit)

const heightOf = (storeys: number) => METRICS.building.groundFloorHeight + (storeys - 1) * METRICS.building.storeyHeight

/** A plot of a kind, with a name of its own, standing on a street to the south. */
function place(kind: string, name: string, storeys = 3, at = 4): ReturnType<typeof plotOf> {
  return plotOf({ kind, name, storeys, rect: { x: at, y: at, w: 3, h: 3 }, entrance: { cell: { x: at + 1, y: at + 3 }, facing: 'south' } })
}

/** The building a plot gets, built to its storeys from its preset charter. */
function built(plot: ReturnType<typeof plotOf>, storeys: number): THREE.Object3D {
  return dressing.building(plot, sizeOf(plot, heightOf(storeys)), charterOf(plot))
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

    expect(readSigns(built(anchor, 3))).toContain('THE RUSTY ANCHOR')
    // and it is the plot's name, not a fixture: rename the place and the wall changes
    const other = place('bar', 'Kettle & Coil')
    expect(readSigns(built(other, 3))).toContain('KETTLE & COIL')
  })

  it('spells the word its charter gave it down the blade', () => {
    const hotel = place('hotel', 'Marlow House')
    // the blade carries the trade, which is the wayfinding: name over the door, trade down the wall
    expect(readSigns(built(hotel, 5))).toContain('HOTEL')
    // a word no preset knows spells what its own charter says, with no table in between
    const jail = inventedCharter()
    const plot = plotOf({ kind: jail.word, name: 'The Old Bridewell', storeys: 5, rect: { x: 4, y: 4, w: 3, h: 3 }, entrance: { cell: { x: 5, y: 7 }, facing: 'south' } }, jail)
    const written = readSigns(dressing.building(plot, sizeOf(plot, heightOf(5)), jail))
    expect(written).toContain('JAIL')
    expect(written).toContain('THE OLD BRIDEWELL')
  })

  it('gives every building a sign and only the loud ones a wall full of them', () => {
    const counts = new Map<string, number>()
    for (const charter of SHIPPED_CHARTERS) {
      const plot = place(charter.word, 'Somewhere Or Other', 4)
      const signs = signsFor(plot, sizeOf(plot, heightOf(4)), charter)
      expect(signs.length, charter.word).toBeGreaterThan(0)
      counts.set(charter.word, signs.length)
    }
    expect(counts.get('bar')!).toBeGreaterThan(counts.get('house')!)
    expect(counts.get('restaurant')!).toBeGreaterThan(counts.get('chapel')!)
  })

  it('draws every sign in the city with one material, so the lot is one draw', () => {
    const materials = new Set<THREE.Material>()
    const shapes = new Set<string>()
    for (let at = 0; at < 24; at++) {
      const plot = place(SHIPPED_CHARTERS[at % SHIPPED_CHARTERS.length]!.word, `Number ${at} Street`, 2 + (at % 5))
      const mesh = signMesh(built(plot, 2 + (at % 5)))
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
    for (const { word: kind } of SHIPPED_CHARTERS) {
      for (const storeys of [1, 3, 6]) {
        const plot = place(kind, 'The Long Way Round', storeys)
        const size = sizeOf(plot, heightOf(storeys))
        const building = built(plot, storeys)
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

    expect(signsFor(plot, size, charterOf(plot))).toEqual(signsFor(plot, size, charterOf(plot)))
    expect(fingerprint(again.building(plot, size, charterOf(plot)))).toBe(fingerprint(dressing.building(plot, size, charterOf(plot))))
    // a different place is different signage, so this is not passing on an empty wall
    const other = place('cafe', 'Ashgate Kitchen', 4)
    expect(signsFor(other, size, charterOf(other))).not.toEqual(signsFor(plot, size, charterOf(plot)))
  })

  it('is dark at noon and burns after it', () => {
    // the whole switch is the city's night level, so a sign cannot glow in daylight
    expect(nightLook(12).level).toBe(0)
    expect(nightLook(22).level).toBe(1)
    expect(reaches(emissiveOf(kit.material(SIGN.material)), kit.night.level), 'the emissive is wired to the clock').toBe(true)
  })

  it('burns every colour of tube to the same luminance, whatever colour it is', () => {
    // the number authored per colour is what it emits, not a multiplier: one
    // to tune for the whole palette, and every hue over the 0.9 the app's
    // night bloom gates on
    const readings = NEON.map((neon) => luminanceOf(neon.ink) * neon.glow)
    expect(Math.max(...readings)).toBeCloseTo(Math.min(...readings), 9)
    expect(Math.min(...readings), 'over the threshold a halo starts at').toBeGreaterThan(0.9)
    // a station's box is a tube like any other; the lamp at a door is a surface and stays under its own colour
    expect(luminanceOf(TRANSIT.ink) * TRANSIT.glow).toBeCloseTo(readings[0]!, 9)
    expect(DOORLIGHT.glow, 'a lamp is not a tube').toBeLessThanOrEqual(1)
  })

  it('holds a cell for every letter it can write', () => {
    for (const key of GLYPH_KEYS) {
      const [u0, v0, u1, v1] = cellUv(key)
      expect(cellAt((u0 + u1) / 2, (v0 + v1) / 2), key).toBe(key)
    }
  })
})

describe('signage on a generated town', () => {
  const town = townOf('signage', 120)
  const planned = town.map((plot) => {
    const size = sizeOf(plot, heightOf(plot.storeys))
    return { plot, size, signs: signsFor(plot, size, charterOf(plot)) }
  })

  /** The outward normal of each wall, and how far its plane is from the building's middle. */
  const wallOf = (sign: Sign, size: { width: number; depth: number }): { normal: [number, number]; half: number } => ({
    normal: { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[sign.wall] as [number, number],
    half: sign.wall === 'north' || sign.wall === 'south' ? size.depth / 2 : size.width / 2,
  })

  /** The patch of wall a sign takes, as `along` the wall and `up` it: a flat one its face, a hung one its bracket. */
  const patch = (sign: Sign): { a0: number; a1: number; u0: number; u1: number } => {
    const right = sign.mount === 'flat' ? sign.right : [sign.right[1], -sign.right[0]]
    const along = sign.origin[0] * right[0] + sign.origin[2] * right[1]
    const width = sign.mount === 'flat' ? sign.width : SIGN.foot
    return { a0: along - width / 2, a1: along + width / 2, u0: sign.origin[1] - sign.height / 2, u1: sign.origin[1] + sign.height / 2 }
  }

  /** The ways a sign is read: a flat one from the street, a hung one from either end of it. */
  const facings = (sign: Sign): ReadonlyArray<readonly [number, number]> =>
    sign.mount === 'hung' ? [sign.right, [-sign.right[0], -sign.right[1]]] : [sign.right]

  /** One quad of a sign in the plane it is drawn on: where it sits across and up, and how far out it stands. */
  const quadOf = (sign: Sign, right: readonly [number, number], written: { u: number; v: number; width: number; height: number }, layer: number) => {
    const out = [-right[1], right[0]] as const
    const [x, z] = [sign.origin[0] + right[0] * written.u + out[0] * layer, sign.origin[2] + right[1] * written.u + out[1] * layer]
    const along = x * right[0] + z * right[1]
    return { a0: along - written.width / 2, a1: along + written.width / 2, v0: sign.origin[1] + written.v - written.height / 2, v1: sign.origin[1] + written.v + written.height / 2, depth: x * out[0] + z * out[1] }
  }

  it('claims its wall, so no two lit things overlap and every one lies on the wall it names', () => {
    let [flat, hung] = [0, 0]
    for (const { plot, size, signs } of planned) {
      // the box over a subway entrance stands on the doorstep, held to that in fixtures.test.ts
      for (const sign of signs.filter((sign) => sign.kind !== 'subway')) {
        const { normal, half } = wallOf(sign, size)
        const facing = [-sign.right[1], sign.right[0]]
        const dot = facing[0]! * normal[0] + facing[1]! * normal[1]
        const off = sign.origin[0] * normal[0] + sign.origin[2] * normal[1] - half
        if (sign.mount === 'flat') {
          flat++
          expect(dot, `${plot.id} looks the way its wall does`).toBeCloseTo(1, 9)
          expect(off, `${plot.id} stands on its wall`).toBeCloseTo(SIGN.stand, 9)
        } else {
          hung++
          expect(dot, `${plot.id} hangs at a right angle`).toBeCloseTo(0, 9)
          expect(off - sign.width / 2, `${plot.id} starts at its wall`).toBeCloseTo(SIGN.stand, 9)
        }
      }
      const patches = signs.filter((sign) => sign.kind !== 'subway').map((sign) => ({ wall: sign.wall, ...patch(sign) }))
      for (let i = 0; i < patches.length; i++) {
        for (let j = i + 1; j < patches.length; j++) {
          const [a, b] = [patches[i]!, patches[j]!]
          if (a.wall !== b.wall) continue
          const crossed = a.a0 < b.a1 && b.a0 < a.a1 && a.u0 < b.u1 && b.u0 < a.u1
          expect(crossed, `${plot.id}: sign ${i} through sign ${j}`).toBe(false)
        }
      }
    }
    expect(flat).toBeGreaterThan(200)
    expect(hung, 'and the town has things hanging over its streets').toBeGreaterThan(20)
  })

  it('sizes every letter off the fascia', () => {
    const fascia = METRICS.building.groundFloorHeight - MODULE.height
    let tallest = 0
    for (const { signs } of planned) {
      for (const sign of signs) {
        for (const written of sign.glyphs) if (written.cell !== SOLID) tallest = Math.max(tallest, written.height)
      }
    }
    expect(tallest).toBeLessThanOrEqual(fascia * LETTER_SHARE + 1e-9)
    // and the cap is reached, so it is the cap and not a coincidence
    expect(tallest).toBeCloseTo(fascia * LETTER_SHARE, 6)
  })

  it('writes its letters on its panel and lays nothing thin over it', () => {
    // a bar drawn across a panel is a few pixels tall from the pavement (5 cm reads 15 px at 5 m, 4 px at 20 m)
    // and it sits a centimetre off the surface behind it, which is what a dotted rule under a fascia is made of
    let full = 0
    for (const { plot, signs } of planned) {
      for (const sign of signs) {
        for (const written of sign.glyphs) {
          if (written.cell !== SOLID) continue
          full++
          // the only full-cover quad is a sign that is itself a bar of light: the lamp at a door, a tube up a corner
          expect(written.width, `${plot.id}: a bar across a ${sign.kind}`).toBeGreaterThanOrEqual(sign.width - 1e-9)
          expect(written.height, `${plot.id}: a bar across a ${sign.kind}`).toBeGreaterThanOrEqual(sign.height - 1e-9)
        }
        // and no two quads of a sign lie in the same plane over each other, whichever way it is read
        for (const face of facings(sign)) {
          const laid = [quadOf(sign, face, { u: 0, v: 0, width: sign.width, height: sign.height }, 0), ...sign.glyphs.map((written) => quadOf(sign, face, written, SIGN.layer))]
          for (let i = 0; i < laid.length; i++) {
            for (let j = i + 1; j < laid.length; j++) {
              const [a, b] = [laid[i]!, laid[j]!]
              const over = Math.min(a.a1, b.a1) - Math.max(a.a0, b.a0) > 1e-9 && Math.min(a.v1, b.v1) - Math.max(a.v0, b.v0) > 1e-9
              expect(over && Math.abs(a.depth - b.depth) < 1e-9, `${plot.id}: two quads of a ${sign.kind} in one plane`).toBe(false)
            }
          }
        }
      }
    }
    expect(full, 'the town has bars of light on it').toBeGreaterThan(200)
  })

  it('never burns a lit surface past its own colour', () => {
    let boxes = 0
    for (const { plot, signs } of planned) {
      for (const sign of signs) {
        if (sign.glow[1] <= 0) continue
        boxes++
        // a whole panel alight is a surface, not a tube: it lands under its own colour, four metres of it
        expect(sign.glow[1], plot.id).toBeLessThanOrEqual(1)
      }
    }
    expect(boxes, 'the town has nameplates lit from behind').toBeGreaterThan(5)
  })

  it('lights every colour of tube in town to the same reading, so the hot ones glow too', () => {
    // a saturated red carries a third of a pale cyan's luminance, and what the
    // app's bloom reads is the luminance against a hard threshold of 0.9 after
    // dark: a hue landing under it wears no halo at all, whatever it was
    // authored to be worth
    const loudest = new Map<number, number>()
    for (const { signs } of planned) {
      for (const sign of signs) {
        if (sign.glow[0] <= 0 || sign.kind === 'doorlamp') continue
        loudest.set(sign.ink, Math.max(loudest.get(sign.ink) ?? 0, luminanceOf(sign.ink) * sign.glow[0]))
      }
    }
    const readings = [...loudest.values()].sort((a, b) => a - b)
    expect(loudest.size, 'the town wears the whole palette').toBeGreaterThanOrEqual(8)
    expect(readings[0]!, 'and the dimmest colour on it still glows').toBeGreaterThan(0.9)
    expect(readings.at(-1)! / readings[0]!, 'no colour twice another').toBeLessThanOrEqual(1.1 + 1e-9)
  })

  it('lights the door with a lamp either side of it, never a column', () => {
    const { doorHeight, doorWidth } = METRICS.building
    for (const { plot, size, signs } of planned) {
      const lamps = signs.filter((sign) => sign.kind === 'doorlamp')
      expect(lamps, plot.id).toHaveLength(2)
      const door = dressing.building(plot, size, charterOf(plot)).getObjectByName('door')!
      for (const lamp of lamps) {
        // sized to the door: no taller than its head, a few centimetres wide, and never past its own colour
        expect(lamp.origin[1] + lamp.height / 2, plot.id).toBeLessThanOrEqual(doorHeight + DOORLAMP.overhead + 1e-9)
        expect(lamp.width, plot.id).toBeLessThanOrEqual(0.06)
        expect(lamp.glow[0], plot.id).toBeLessThanOrEqual(1)
        // beside the frame, on the door's own wall
        const beside = (lamp.origin[0] - door.position.x) * lamp.right[0] + (lamp.origin[2] - door.position.z) * lamp.right[1]
        expect(Math.abs(beside), plot.id).toBeCloseTo(doorWidth / 2 + DOORLAMP.beside, 6)
      }
    }
  })

  it('publishes a light for everything it lit', () => {
    for (const { plot, size, signs } of planned) {
      const lights = lightsFor(plot, size, charterOf(plot))
      expect(lights.map((light) => light.kind), plot.id).toEqual(signs.map((sign) => sign.kind))
      expect(dressing.lights(plot, size, charterOf(plot)), 'the dressing answers the same').toEqual(lights)
      lights.forEach((light, at) => {
        const sign = signs[at]!
        const apart = Math.hypot(light.position[0] - sign.origin[0], light.position[1] - sign.origin[1], light.position[2] - sign.origin[2])
        expect(apart, plot.id).toBeLessThanOrEqual(0.25)
        expect(light.intensity, plot.id).toBeGreaterThan(0)
        expect(light.radius, plot.id).toBeGreaterThan(1)
        if (sign.glow[0] >= sign.glow[1]) expect(light.colour, 'a tube lights in its own colour').toBe(sign.ink)
      })
    }
    // a lamp at the door is a fixture: one strength whatever the trade, and under the name it stands beside
    const lit = planned.map(({ plot, size }) => lightsFor(plot, size, charterOf(plot)))
    const lamps = new Set(lit.flat().filter((light) => light.kind === 'doorlamp').map((light) => light.intensity.toFixed(6)))
    expect(lamps.size).toBe(1)
    const names = lit.map((lights) => lights[0]!.intensity).sort((a, b) => a - b)
    expect(Number([...lamps][0])).toBeLessThan(names[Math.floor(names.length / 2)]!)
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
