import type { CityNight } from '@gb/kitbash'
import * as THREE from 'three'
import { Fn, If, float, floor, hash, mix, positionWorld, step, uniformArray, vec3, vec4 } from 'three/tsl'
import type { Node } from 'three/webgpu'
import { Bays } from './bays.ts'
import { layerIndex } from './layer.ts'
import { flatPanel } from './panel.ts'
import { BAY, BOXED, SALT } from './pick.ts'
import { roomBox } from './roombox.ts'
import { ROOM_TINTS, type Banks, type GlazingStrip } from './rooms.ts'
import type { SurfaceFrame } from './surface.ts'

/**
 * What is behind the glass, drawn in the fragment shader.
 *
 * A prefab wall is a flat quad with a picture on it, so a window was a painted
 * rectangle and nothing else: at a distance that reads as a city and from the
 * pavement it reads as a bright square. This says, per window, which of two
 * kinds it is, and draws it.
 *
 * The flat kind shows one picture across the opening: a curtain, a blind, a
 * shutter, a lit panel. The boxed kind marches the view ray through a room
 * behind the opening, reading a back wall and four shared faces off the same
 * strip, so the room slides in the frame as you walk past and the side walls
 * close in at an angle. Which kind a window gets is a hash of where its bay
 * sits, weighted so street level keeps most of its rooms and the floors above
 * mostly do not, which is both what a real street shows and where the fragment
 * budget belongs.
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
 * through, and how rough what is behind the glass is: plaster, shelves and
 * fittings, or a curtain, seen through the pane in front of them.
 */
export const ROOM = { glow: 2.2, albedo: 0.5, roughness: 0.85 } as const

/** A window with its lights off is not black: something is always on standby behind it. */
const UNLIT = 0.07

/** What is behind the glass here: the light in the window, and how much of the fragment is opening. */
export interface Glazing {
  readonly light: Node<'vec3'>
  readonly share: Node<'float'>
}

/**
 * Every window in the city, as one node the building material mixes over its
 * wall picture.
 *
 * Which layers have windows comes from the pack's own list of finishes, and
 * which layers of the strip are rooms, panels and faces comes from the pack's
 * own manifest, so the runtime reads what the art says rather than assuming it.
 * A layer with no windows costs one comparison and no texture fetch.
 */
export class InteriorWindows {
  readonly #glazing: (frame: SurfaceFrame) => Node<'vec4'>

  constructor(strip: THREE.DataArrayTexture, layout: GlazingStrip, night: CityNight, finishes: readonly string[]) {
    const bays = new Bays(finishes)
    const tints = uniformArray<'vec3'>(ROOM_TINTS.map(([r, g, b]) => new THREE.Vector3(r, g, b)), 'vec3')

    this.#glazing = (frame: SurfaceFrame) => Fn(() => {
      const layer = layerIndex()
      const out = vec4(0, 0, 0, 0).toVar()

      If(bays.windowed(layer), () => {
        const bay = bays.layout(layer, frame)

        // everything about this window is a pure function of where its bay is,
        // so a building draws the same windows on every machine and every run
        const seed = bay.id.x.mul(BAY.across).add(bay.id.y.mul(BAY.down)).add(BAY.first)
        const shop = bay.street.mul(step(positionWorld.y, STREET_LEVEL))
        const flip = step(0.5, hash(seed.add(SALT.mirror)))
        const light = vec3(0, 0, 0).toVar()

        If(hash(seed.add(SALT.kind)).lessThan(mix(float(BOXED.upper), float(BOXED.street), shop)), () => {
          light.assign(roomBox(strip, layout.faces, bay, frame, layerFrom(layout.rooms, shop, seed), flip, step(0.5, hash(seed.add(SALT.wall)))))
        }).Else(() => {
          light.assign(flatPanel(strip, bay, layerFrom(layout.panels, shop, seed), flip))
        })

        const lit = step(hash(seed).mul(bay.keys), night.lit)
        out.assign(
          vec4(
            light
              .mul(tints.element(floor(hash(seed.add(SALT.tint)).mul(ROOM_TINTS.length)).toInt()))
              .mul(mix(float(UNLIT), float(1), lit)),
            bay.share,
          ),
        )
      })

      return out
    })()
  }

  /**
   * What is behind the glass on the layer this fragment wears. The frame is the
   * material's own, read outside every branch: a derivative taken inside flow
   * that only some fragments of a quad enter is not defined.
   */
  glazing(frame: SurfaceFrame): Glazing {
    const seen = this.#glazing(frame).toVar()
    return { light: seen.rgb, share: seen.a }
  }
}

/**
 * Which layer of a run this window draws.
 *
 * The two runs may overlap, which is how one picture serves both a shop window
 * and a room three floors up without being stored twice, so a bank is a first
 * layer and a count rather than a slice of its own.
 */
function layerFrom(banks: Banks, shop: Node<'float'>, seed: Node<'float'>): Node<'int'> {
  const first = mix(float(banks.upper.first), float(banks.street.first), shop)
  const held = mix(float(banks.upper.count), float(banks.street.count), shop)
  return first.add(floor(hash(seed.add(SALT.picture)).mul(held))).toInt()
}
