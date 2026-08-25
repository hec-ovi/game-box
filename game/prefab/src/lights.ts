import type { LightEmitter as KitLight } from '@gb/kitbash'
import type { Facing } from '@gb/world'
import type * as THREE from 'three'
import { SCREEN, pictureFor } from './display.ts'
import { DOOR_FINISH } from './entrance.ts'
import { LAYER_ATTRIBUTE } from './pack.ts'
import { DISPLAY_FINISH } from './screens.ts'

/**
 * What a prefab building throws onto the street, for whoever owns the lights.
 *
 * The same shape `@gb/kitbash` publishes for its signs, with two more kinds:
 * `entrance`, the lobby of a door you can walk through, and `screen`, a lit
 * panel. `position` is metres in the building's own frame, just off the lit
 * face; `colour` is what burns, packed `0xRRGGBB`; `intensity` is candela at
 * full dark; `radius` is the metres past which it is not worth drawing, where
 * it falls to 0.1 lux, at most 16. Nothing here draws them.
 */
export interface LightEmitter extends Omit<KitLight, 'kind'> {
  readonly kind: KitLight['kind'] | 'entrance' | 'screen'
}

/** How far an emitter sits off the face it lights, so it reaches the wall round it. */
const STAND = 0.2

/** The lit lobby seen through the door: warm, and the share of the door that is glass. */
const LOBBY = { colour: 0xffdbaa, candela: 9, glass: 0.6 } as const

/** What a square metre of screen is worth at full glow, before the picture's own brightness. */
const SCREEN_CANDELA = 20

/** Where an emitter stops being worth drawing, in lux. */
const FAINT = 0.1
const FARTHEST = 16

/** One picture's mean colour, packed, and its mean brightness, so a screen throws its own light. */
export interface ScreenTint {
  readonly colour: number
  readonly brightness: number
}

/**
 * The lights of one dressed plot, read off the geometry it is drawn with, so a
 * mirrored building turned onto an east wall lights the east pavement.
 */
export class BuildingLights {
  readonly #door: number
  readonly #display: number
  readonly #tints: readonly ScreenTint[]

  constructor(finishes: readonly string[], tints: readonly ScreenTint[]) {
    this.#door = finishes.indexOf(DOOR_FINISH)
    this.#display = finishes.indexOf(DISPLAY_FINISH)
    this.#tints = tints
  }

  /**
   * The emitters on a geometry `orient` has already turned onto its plot. The
   * door is measured on its plain layer, which is where it is before the
   * dressing lights it, so this reads the same geometry whichever door it ends
   * up wearing.
   */
  of(geometry: THREE.BufferGeometry, facing: Facing, lit: boolean, rooms: number): LightEmitter[] {
    const out = outward(facing)
    const found: LightEmitter[] = []
    const door = lit ? boxOf(geometry, this.#door) : undefined
    if (door) {
      const area = door.size[0] * door.size[1] * LOBBY.glass
      found.push(emitter('entrance', door, out, LOBBY.colour, area * LOBBY.candela))
    }
    const tint = this.#tints[pictureFor(rooms)]
    if (tint) {
      for (const panel of panelsOf(geometry, this.#display)) {
        const [wide, tall] = [...panel.size].sort((a, b) => b - a)
        found.push(emitter('screen', panel, out, tint.colour, wide! * tall! * SCREEN_CANDELA * tint.brightness * SCREEN.glow))
      }
    }
    return found
  }
}

/**
 * The mean of every picture on the screen strip, so a board's light is the
 * colour of what it shows. Read once off the bytes the pack was decoded from.
 */
export function screenTints(screens: THREE.DataArrayTexture): ScreenTint[] {
  const { width, height, depth, data } = screens.image
  const pixels = width * height
  const bytes = data as Uint8Array
  const tints: ScreenTint[] = []
  for (let layer = 0; layer < depth; layer++) {
    const sum = [0, 0, 0]
    for (let at = layer * pixels * 4; at < (layer + 1) * pixels * 4; at += 4) {
      for (let c = 0; c < 3; c++) sum[c]! += bytes[at + c]!
    }
    const mean = sum.map((v) => Math.round(v / pixels))
    const linear = mean.map((v) => (v / 255) ** 2.2)
    tints.push({
      colour: (mean[0]! << 16) | (mean[1]! << 8) | mean[2]!,
      brightness: 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!,
    })
  }
  return tints
}

interface Box {
  readonly centre: [number, number, number]
  readonly size: [number, number, number]
}

/** Outward off the wall the door is on, in the building's frame: the street is that way. */
function outward(facing: Facing): [number, number] {
  return [facing === 'east' ? 1 : facing === 'west' ? -1 : 0, facing === 'south' ? 1 : facing === 'north' ? -1 : 0]
}

function emitter(kind: LightEmitter['kind'], box: Box, out: [number, number], colour: number, intensity: number): LightEmitter {
  const stand = Math.min(...box.size) / 2 + STAND
  const position: [number, number, number] = [box.centre[0] + out[0] * stand, box.centre[1], box.centre[2] + out[1] * stand]
  return { kind, position, colour, intensity, radius: Math.min(FARTHEST, Math.sqrt(intensity / FAINT)) }
}

/** The bounding box of every vertex wearing a layer, or nothing when none does. */
function boxOf(geometry: THREE.BufferGeometry, wearing: number): Box | undefined {
  const position = geometry.getAttribute('position')
  const layer = geometry.getAttribute(LAYER_ATTRIBUTE)
  const low = [Infinity, Infinity, Infinity]
  const high = [-Infinity, -Infinity, -Infinity]
  let seen = false
  for (let i = 0; i < layer.count; i++) {
    if (Math.round(layer.getX(i)) !== wearing) continue
    seen = true
    const point = [position.getX(i), position.getY(i), position.getZ(i)]
    for (let c = 0; c < 3; c++) {
      low[c] = Math.min(low[c]!, point[c]!)
      high[c] = Math.max(high[c]!, point[c]!)
    }
  }
  return seen ? box(low, high) : undefined
}

/**
 * Every separate plate on a layer: the triangles wearing it, joined wherever
 * they meet at a point, so a board on the parapet and a banner by the door come
 * back as two boxes. Points are matched by where they are rather than by
 * index, so a geometry nobody welded clusters the same.
 */
function panelsOf(geometry: THREE.BufferGeometry, wearing: number): Box[] {
  const index = geometry.getIndex()
  const layer = geometry.getAttribute(LAYER_ATTRIBUTE)
  const position = geometry.getAttribute('position')
  if (!index || wearing < 0) return []

  const points = new Map<string, number>()
  const pointOf = (vertex: number): number => {
    const key = [position.getX(vertex), position.getY(vertex), position.getZ(vertex)].map((v) => Math.round(v * 1000)).join(',')
    const found = points.get(key)
    if (found !== undefined) return found
    points.set(key, vertex)
    return vertex
  }
  const parent = new Map<number, number>()
  const root = (a: number): number => {
    let at = a
    while (parent.get(at) !== at) at = parent.get(at)!
    parent.set(a, at)
    return at
  }
  const corners: number[][] = []
  for (let t = 0; t < index.count; t += 3) {
    const vertices = [index.getX(t), index.getX(t + 1), index.getX(t + 2)]
    if (vertices.some((v) => Math.round(layer.getX(v)) !== wearing)) continue
    const ids = vertices.map(pointOf)
    for (const id of ids) if (!parent.has(id)) parent.set(id, id)
    parent.set(root(ids[0]!), root(ids[1]!))
    parent.set(root(ids[1]!), root(ids[2]!))
    corners.push(vertices)
  }

  const bounds = new Map<number, { low: number[]; high: number[] }>()
  for (const vertices of corners) {
    const key = root(pointOf(vertices[0]!))
    const found = bounds.get(key) ?? { low: [Infinity, Infinity, Infinity], high: [-Infinity, -Infinity, -Infinity] }
    for (const vertex of vertices) {
      const point = [position.getX(vertex), position.getY(vertex), position.getZ(vertex)]
      for (let c = 0; c < 3; c++) {
        found.low[c] = Math.min(found.low[c]!, point[c]!)
        found.high[c] = Math.max(found.high[c]!, point[c]!)
      }
    }
    bounds.set(key, found)
  }
  return [...bounds.values()].map(({ low, high }) => box(low, high))
}

function box(low: number[], high: number[]): Box {
  return {
    centre: [(low[0]! + high[0]!) / 2, (low[1]! + high[1]!) / 2, (low[2]! + high[2]!) / 2],
    size: [high[0]! - low[0]!, high[1]! - low[1]!, high[2]! - low[2]!],
  }
}
