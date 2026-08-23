import type { CityNight } from '@gb/kitbash'
import * as THREE from 'three'
import {
  Fn,
  If,
  abs,
  cameraPosition,
  clamp,
  dFdx,
  dFdy,
  float,
  floor,
  fract,
  fwidth,
  hash,
  max,
  min,
  mix,
  normalWorld,
  normalize,
  positionWorld,
  select,
  smoothstep,
  step,
  texture,
  uniformArray,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
import type { Node } from 'three/webgpu'
import { layerIndex } from './layer.ts'
import { ROOM_BANKS, ROOM_SIZE } from './rooms.ts'

/**
 * What is behind the glass, drawn in the fragment shader.
 *
 * A prefab wall is a flat quad with a picture on it, so a window was a painted
 * rectangle and nothing else: at a distance that reads as a city and from the
 * pavement it reads as a bright square. This cuts the openings out of the
 * picture arithmetically and marches the view ray through the box behind each
 * one, sampling a photographed room on whichever face of it the ray meets. The
 * room slides in the frame as you walk past, the side walls close in at an
 * angle, and the light in it reaches the street through the app's bloom.
 *
 * It costs no geometry, no draw and no vertex. What a fragment needs is where
 * it sits in the picture, which the uv already says, and how many metres wide a
 * bay is, which the surface's own derivatives already say. `@gb/kitbash` does
 * the same for the kit's modelled panes and carries the room on the vertices,
 * because it has vertices to carry it on; here a storey is eight triangles.
 */

/** Below this, a window looks into a shop; above it, into a room somebody lives or works in. */
const STREET_LEVEL = 4.6

/**
 * How hard a lit room burns after dark, what it lends the surface it is seen
 * through, and how smooth a pane is against the wall around it, so the glass
 * takes a highlight the wall does not.
 */
export const ROOM = { glow: 2.2, albedo: 0.5, roughness: 0.14 } as const

/** A room with its lights off is not black: something is always on standby in it. */
const UNLIT = 0.07

/**
 * How fast the window grid gives up as it shrinks, and how close to the back
 * wall still counts as the back wall. The first is a pixel's footprint against
 * a bay; past 1 the bay is the flat share of itself that is glass.
 */
const MELT = 1.5
const BACK_WALL = 0.985

/** How dark the room is where it meets the glass against how bright at the back of it. */
const NEAR_DARK = 0.25

/**
 * How dark a floor, a ceiling or a side wall is against the back wall.
 *
 * The picture is a photograph of a room from its window, so it belongs on the
 * back wall; the other four faces sample the row or the column of it they meet
 * and would smear that across half a pane. Taking them well down turns the
 * smear into what it should have been, which is a surface out of the light.
 */
const SIDE_DARK = 0.4

/**
 * What a pane catches off the street when it is not being looked into.
 *
 * Stand square to a shop window and you see the shop; stand along the street
 * and you see the road in the glass. Without this a facade seen edge on goes
 * black, because every ray at that angle leaves the room through a side wall.
 * It is a fixed cool tone rather than a reflection: at a grazing angle a pane
 * is a smear of the street, and the street here is wet tarmac under neon.
 */
const SHEEN: readonly [number, number, number] = [0.1, 0.15, 0.21]

/**
 * What burns in a room. Five of the eight are warm, because a street of lit
 * windows after dark is mostly tungsten and only some of it is the strip light
 * in an office; the saturated three are the accents `docs/LOOK.md` asks for.
 */
const TINTS: ReadonlyArray<readonly [number, number, number]> = [
  [1.0, 0.87, 0.68],
  [1.0, 0.74, 0.45],
  [1.0, 0.9, 0.78],
  [1.0, 0.8, 0.55],
  [0.94, 0.96, 1.0],
  [0.62, 0.9, 1.0],
  [0.72, 1.0, 0.9],
  [1.0, 0.7, 0.87],
]

/** How a kind of window lays a bay out, and what sort of room sits behind it. */
export interface WindowKind {
  /** Bays across and floors down one unit of the picture's uv: what the producer was told. */
  readonly grid: { readonly across: number; readonly down: number }
  /** How far the surround reaches into a bay from each edge, as a share of the bay. */
  readonly frame: { readonly across: number; readonly down: number }
  /** How the opening is divided, and how wide a mullion is as a share of one pane. */
  readonly panes: { readonly across: number; readonly down: number; readonly mullion: number }
  /** Metres the room runs back from the glass. */
  readonly deep: number
  /**
   * How much of the night's lit share it takes to light one. Under 1 lights
   * more of them, which is the difference between a street of shops and a
   * street of offices.
   */
  readonly keys: number
  /** Whether one of these near the ground looks into a shop rather than a room. */
  readonly street: boolean
  /** The shortest bay, in metres, worth cutting a window into. A parapet band is not one. */
  readonly shortest: number
}

/** A wall above the street: a bay of curtain wall, six panes, an office or a flat behind it. */
export const FACADE: WindowKind = {
  grid: { across: 4, down: 2 },
  frame: { across: 0.15, down: 0.17 },
  panes: { across: 3, down: 2, mullion: 0.055 },
  deep: 3.4,
  keys: 1,
  street: false,
  shortest: 1.6,
}

/** Street level: one wide pane a player stands a metre from, and most of them are open. */
export const SHOPFRONT: WindowKind = {
  grid: { across: 2, down: 1 },
  frame: { across: 0.07, down: 0.11 },
  panes: { across: 2, down: 1, mullion: 0.03 },
  deep: 5,
  keys: 0.32,
  street: true,
  shortest: 1.6,
}

/** Which kind of window a finish wears, if any: a roof, a door and a neon tube have none. */
export function windowsOn(finish: string): WindowKind | undefined {
  if (finish.endsWith(':facade')) return FACADE
  if (finish === 'glass') return SHOPFRONT
  return undefined
}

/** The share of a bay that is glass once the surround and the mullions are out of it. */
export function glassShareOf(kind: WindowKind): number {
  return (1 - kind.frame.across * 2) * (1 - kind.frame.down * 2) * (1 - kind.panes.mullion * 2) ** 2
}

/** What is behind the glass here: the light in the room, and how much of the fragment is pane. */
export interface Glazing {
  readonly light: Node<'vec3'>
  readonly share: Node<'float'>
}

/**
 * The rooms behind every pane in the city, as one node the building material
 * mixes over its wall picture.
 *
 * Which layers have windows comes from the pack's own list of finishes, so the
 * runtime reads what the pack says rather than assuming it. A layer with no
 * windows costs one comparison and no texture fetch.
 */
export class InteriorWindows {
  readonly #glazing: () => Node<'vec4'>

  constructor(rooms: THREE.DataArrayTexture, night: CityNight, finishes: readonly string[]) {
    const shape = uniformArray<'vec4'>(finishes.map((finish) => shapeOf(windowsOn(finish))), 'vec4')
    const glass = uniformArray<'vec4'>(finishes.map((finish) => paneOf(windowsOn(finish))), 'vec4')
    const look = uniformArray<'vec4'>(finishes.map((finish) => lookOf(windowsOn(finish))), 'vec4')
    const tints = uniformArray<'vec3'>(TINTS.map(([r, g, b]) => new THREE.Vector3(r, g, b)), 'vec3')

    this.#glazing = Fn(() => {
      // the surface's own derivatives, read before the branch: a quad that
      // straddles two layers takes both sides of it, and a derivative read
      // inside flow like that is not defined
      const dpx = dFdx(positionWorld)
      const dpy = dFdy(positionWorld)
      const duvx = dFdx(uv())
      const duvy = dFdy(uv())
      const spread = fwidth(uv())

      const layer = layerIndex()
      const bay = shape.element(layer)
      const pane = glass.element(layer)
      const room = look.element(layer)
      const out = vec4(0, 0, 0, 0).toVar()

      If(bay.x.greaterThan(0), () => {
        // where this fragment sits in its bay, and which bay that is. The
        // picture tiles, so the bay index runs on along the wall and the room
        // it names never repeats with the picture
        const grid = vec2(bay.x, bay.y)
        const cell = uv().mul(grid)
        const id = floor(cell)
        const at = cell.sub(id)
        const aa = spread.mul(grid).add(1e-5)

        // how many metres a unit of uv covers, straight off the surface, so a
        // bay is the size it really is however the producer stretched the
        // picture onto that wall and whichever way round the building is
        const det = duvx.x.mul(duvy.y).sub(duvx.y.mul(duvy.x))
        const safe = select(det.greaterThanEqual(0), max(det, 1e-12), min(det, -1e-12))
        const along = dpx.mul(duvy.y).sub(dpy.mul(duvx.y)).div(safe)
        const down = dpy.mul(duvx.x).sub(dpx.mul(duvy.x)).div(safe)
        const wide = along.length().div(bay.x)
        const tall = down.length().div(bay.y)

        // the opening and the mullions across it, cut arithmetically and
        // feathered by how much of the picture one pixel covers: at a distance
        // the grid melts into the share of the bay that is glass, which is what
        // a mip of a drawn one would have done
        const inner = vec2(float(1).sub(bay.z.mul(2)), float(1).sub(bay.w.mul(2)))
        const panes = vec2(pane.x, pane.y)
        const q = at.sub(vec2(bay.z, bay.w)).div(inner).mul(panes)
        const aq = aa.div(inner).mul(panes)
        const sharp = band(at.x, bay.z, aa.x)
          .mul(band(at.y, bay.w, aa.y))
          .mul(band(fract(q.x), pane.z, aq.x))
          .mul(band(fract(q.y), pane.z, aq.y))
        const melt = clamp(max(aa.x, aa.y).mul(MELT), 0, 1)
        const share = mix(sharp, room.z, melt).mul(step(room.w, tall))

        // which room this bay looks into: a pure function of where the bay is,
        // so a building draws the same rooms on every machine and every run
        const seed = id.x.mul(1973).add(id.y.mul(9277)).add(1)
        const shop = room.y.mul(step(positionWorld.y, STREET_LEVEL))
        const bank = mix(float(ROOM_BANKS.upper.first), float(ROOM_BANKS.street.first), shop)
        const held = mix(float(ROOM_BANKS.upper.count), float(ROOM_BANKS.street.count), shop)
        const picture = bank.add(floor(hash(seed.add(977)).mul(held))).toInt()

        // the box behind the glass, met by the view ray. It is all in the bay's
        // own frame, so batching a building into a shared buffer moves the
        // vertices and leaves the room where it was
        const face = normalize(normalWorld)
        const view = normalize(positionWorld.sub(cameraPosition))
        const ray = vec3(view.dot(along.normalize()), view.dot(down.normalize()), max(view.dot(face).negate(), 1e-3))
        const from = vec3(at.x.mul(wide), at.y.mul(tall), 0)
        const hit = min(min(reach(from.x, wide, ray.x), reach(from.y, tall, ray.y)), pane.w.div(ray.z))
        const met = from.add(ray.mul(hit))
        const sideways = clamp(met.x.div(wide), 0, 1)
        const behind = clamp(met.z.div(pane.w), 0, 1)
        const wall = smoothstep(BACK_WALL, 1, behind)

        // one fetch, at the level the wall itself is being read at. The hit
        // point jumps where the ray changes face, and a mip chosen off that
        // would band along every one of those lines
        const inside = texture(
          rooms,
          vec2(mix(sideways, float(1).sub(sideways), step(0.5, hash(seed.add(6151)))), clamp(met.y.div(tall), 0, 1)),
        )
          .depth(picture)
          .level(max(max(aa.x, aa.y).mul(ROOM_SIZE).log2(), 0)).rgb

        const lit = step(hash(seed).mul(room.x), night.lit)
        const glance = float(1).sub(abs(view.dot(face))).pow(4)
        out.assign(
          vec4(
            inside
              .mul(tints.element(floor(hash(seed.add(3121)).mul(TINTS.length)).toInt()))
              .mul(mix(float(NEAR_DARK), float(1), behind))
              .mul(mix(float(SIDE_DARK), float(1), wall))
              .mul(mix(float(UNLIT), float(1), lit))
              .add(vec3(SHEEN[0], SHEEN[1], SHEEN[2]).mul(glance)),
            share,
          ),
        )
      })

      return out
    })
  }

  /** What is behind the glass on the layer this fragment wears. */
  glazing(): Glazing {
    const seen = this.#glazing().toVar()
    return { light: seen.rgb, share: seen.a }
  }
}

/** 1 between the two insets, 0 outside them, feathered by a pixel's own footprint. */
function band(at: Node<'float'>, inset: Node<'float'>, aa: Node<'float'>): Node<'float'> {
  const low = inset.sub(aa)
  const high = inset.add(aa)
  return smoothstep(low, high, at).mul(smoothstep(low, high, float(1).sub(at)))
}

/** How far the ray runs before it leaves the box on this axis. */
function reach(from: Node<'float'>, size: Node<'float'>, ray: Node<'float'>): Node<'float'> {
  return select(ray.greaterThanEqual(0), size.sub(from), from).div(max(abs(ray), 1e-4))
}

function shapeOf(kind: WindowKind | undefined): THREE.Vector4 {
  if (!kind) return new THREE.Vector4(0, 0, 0, 0)
  return new THREE.Vector4(kind.grid.across, kind.grid.down, kind.frame.across, kind.frame.down)
}

function paneOf(kind: WindowKind | undefined): THREE.Vector4 {
  if (!kind) return new THREE.Vector4(1, 1, 0, 1)
  return new THREE.Vector4(kind.panes.across, kind.panes.down, kind.panes.mullion, kind.deep)
}

function lookOf(kind: WindowKind | undefined): THREE.Vector4 {
  if (!kind) return new THREE.Vector4(1, 0, 0, 0)
  return new THREE.Vector4(kind.keys, kind.street ? 1 : 0, glassShareOf(kind), kind.shortest)
}
