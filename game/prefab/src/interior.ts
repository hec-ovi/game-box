import type { CityNight } from '@gb/kitbash'
import * as THREE from 'three'
import { Fn, If, abs, cameraPosition, clamp, float, floor, hash, max, min, mix, normalWorld, normalize, positionWorld, select, smoothstep, step, texture, uniformArray, vec2, vec3, vec4 } from 'three/tsl'
import type { Node } from 'three/webgpu'
import { Bays } from './bays.ts'
import { layerIndex } from './layer.ts'
import { ROOM_BANKS, ROOM_SIZE, ROOM_TINTS } from './rooms.ts'
import { surfaceFrame } from './surface.ts'

/**
 * What is behind the glass, drawn in the fragment shader.
 *
 * A prefab wall is a flat quad with a picture on it, so a window was a painted
 * rectangle and nothing else: at a distance that reads as a city and from the
 * pavement it reads as a bright square. This marches the view ray through the
 * box behind each opening `Bays` cuts, sampling a photographed room on
 * whichever face of it the ray meets. The room slides in the frame as you walk
 * past, the side walls close in at an angle, and the light in it reaches the
 * street through the app's bloom. The glass itself is a pane in front of this
 * surface, on the building's second material.
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
 * through, and how rough a room's own surfaces are: plaster, shelves and
 * fittings, seen through the pane in front of them.
 */
export const ROOM = { glow: 2.2, albedo: 0.5, roughness: 0.85 } as const

/** A room with its lights off is not black: something is always on standby in it. */
const UNLIT = 0.07

/** How close to the back wall still counts as the back wall. */
const BACK_WALL = 0.985

/** How dark the room is where it meets the glass against how bright at the back of it. */
const NEAR_DARK = 0.25

/**
 * How dark a floor, a ceiling or a side wall is against the back wall.
 *
 * The picture is a photograph of a room from its window, so it belongs on the
 * back wall. The other four faces wear the same picture folded round the back
 * edges, read along the depth of the room, so a side wall is shelves and light
 * fittings seen sideways rather than one column of the picture drawn out across
 * three metres. Taken down, because they are out of the light.
 */
const SIDE_DARK = 0.4

/** What is behind the glass here: the light in the room, and how much of the fragment is opening. */
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
    const bays = new Bays(finishes)
    const tints = uniformArray<'vec3'>(ROOM_TINTS.map(([r, g, b]) => new THREE.Vector3(r, g, b)), 'vec3')

    this.#glazing = Fn(() => {
      // how much wall a unit of uv covers here, read off the surface itself
      // and read before the branch, which is where a derivative has to be taken
      const frame = surfaceFrame()
      const layer = layerIndex()
      const out = vec4(0, 0, 0, 0).toVar()

      If(bays.windowed(layer), () => {
        const bay = bays.layout(layer, frame)

        // which room this bay looks into: a pure function of where the bay is,
        // so a building draws the same rooms on every machine and every run
        const seed = bay.id.x.mul(1973).add(bay.id.y.mul(9277)).add(1)
        const shop = bay.street.mul(step(positionWorld.y, STREET_LEVEL))
        const bank = mix(float(ROOM_BANKS.upper.first), float(ROOM_BANKS.street.first), shop)
        const held = mix(float(ROOM_BANKS.upper.count), float(ROOM_BANKS.street.count), shop)
        const picture = bank.add(floor(hash(seed.add(977)).mul(held))).toInt()

        // the box behind the glass, met by the view ray. It is all in the bay's
        // own frame, so batching a building into a shared buffer moves the
        // vertices and leaves the room where it was
        const face = normalize(normalWorld)
        const view = normalize(positionWorld.sub(cameraPosition))
        const ray = vec3(view.dot(frame.along.normalize()), view.dot(frame.down.normalize()), max(view.dot(face).negate(), 1e-3))
        const from = vec3(bay.at.x.mul(bay.wide), bay.at.y.mul(bay.tall), 0)
        const toSide = reach(from.x, bay.wide, ray.x)
        const toFloor = reach(from.y, bay.tall, ray.y)
        const toBack = bay.deep.div(ray.z)
        const hit = min(min(toSide, toFloor), toBack)
        const met = from.add(ray.mul(hit))
        const sideways = clamp(met.x.div(bay.wide), 0, 1)
        const upward = clamp(met.y.div(bay.tall), 0, 1)
        const behind = clamp(met.z.div(bay.deep), 0, 1)
        const wall = smoothstep(BACK_WALL, 1, behind)

        // the picture belongs on the back wall, and the other four faces wear
        // it folded round the back edges: a side wall reads it along the depth,
        // the floor and the ceiling read it back from the glass, and each one
        // meets the back wall on the row or column it shares with it
        const onBack = toBack.lessThanEqual(toSide).and(toBack.lessThanEqual(toFloor))
        const onSide = toSide.lessThan(toBack).and(toSide.lessThanEqual(toFloor))
        const along = select(ray.x.greaterThanEqual(0), behind, float(1).sub(behind))
        const back = select(ray.y.greaterThanEqual(0), behind, float(1).sub(behind))
        const u = select(onBack, sideways, select(onSide, along, sideways))
        const v = select(onBack, upward, select(onSide, upward, back))

        // one fetch, at the level the wall itself is being read at. The hit
        // point jumps where the ray changes face, and a mip chosen off that
        // would band along every one of those lines
        const inside = texture(rooms, vec2(mix(u, float(1).sub(u), step(0.5, hash(seed.add(6151)))), v))
          .depth(picture)
          .level(max(max(bay.aa.x, bay.aa.y).mul(ROOM_SIZE).log2(), 0)).rgb

        const lit = step(hash(seed).mul(bay.keys), night.lit)
        out.assign(
          vec4(
            inside
              .mul(tints.element(floor(hash(seed.add(3121)).mul(ROOM_TINTS.length)).toInt()))
              .mul(mix(float(NEAR_DARK), float(1), behind))
              .mul(mix(float(SIDE_DARK), float(1), wall))
              .mul(mix(float(UNLIT), float(1), lit)),
            bay.share,
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

/** How far the ray runs before it leaves the box on this axis. */
function reach(from: Node<'float'>, size: Node<'float'>, ray: Node<'float'>): Node<'float'> {
  return select(ray.greaterThanEqual(0), size.sub(from), from).div(max(abs(ray), 1e-4))
}
