import * as THREE from 'three'
import { attribute, color, float, fract, mix, positionWorld, smoothstep, step, uv } from 'three/tsl'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { GLASS } from '../catalog/pieces.ts'
import { bulbOf, roomBehindGlass } from './interior.ts'
import type { CityNight } from './night.ts'
import { ROOM_ATTRIBUTES } from './room.ts'

/** How much brighter than its own colour a lit room burns through the glass. */
const GLOW = 2.4

/** The kit's own glass, flat: what a pane is drawn with from far off. */
export const FAR_GLASS = 'MI_Glass_Far'

/** What a lit window is worth as a flat rectangle, against the room the near pane draws behind it. */
const LIT_WINDOW = 0.42

/**
 * The one material every window pane in the city is drawn with. It raymarches
 * the room the pane carries, dirties it with a film of grime, and after dark
 * lets the lit rooms burn through.
 *
 * There is one of these per loaded kit and it sits in the kit's own glass slot,
 * so a lit window costs no draw of its own: a building draws with exactly the
 * materials it drew with before.
 */
export function windowMaterial(night: CityNight, kitGlass: THREE.Material | undefined): THREE.Material {
  // one raymarch, read by both the colour and the glow
  const room = roomBehindGlass(float(night.lit))
  const inside = room.colour.toVar()

  // old glazing: the room shows through a dusty film, dirtiest along the sill,
  // so a pane reads as glass rather than an open hole
  const streaks = fract(positionWorld.x.mul(0.37).add(positionWorld.z.mul(0.29)).add(positionWorld.y.mul(0.11)))
  const film = float(0.2).add(streaks.mul(0.12)).add(smoothstep(0.3, 0, uv().y).mul(0.22))
  const tint = tintOf(kitGlass)

  const material = new MeshStandardNodeMaterial()
  material.name = GLASS
  material.side = THREE.DoubleSide
  material.colorNode = mix(inside, color(tint), film)
  material.roughnessNode = float(0.16)
  material.metalnessNode = float(0)
  // only the rooms with their lights on glow, and only once it is dark out
  material.emissiveNode = inside.mul(room.lit).mul(float(night.level)).mul(GLOW)
  return material
}

/**
 * The same window from far off: a flat rectangle rather than a room.
 *
 * `@gb/scene` batches every plot's shell at open and dresses only the buildings
 * round the player, so this is what most of the city's glass is drawn with at
 * any moment. It reads the same room the pane carries, so the same windows are
 * lit in the same order in the same bulb as when you walk up to them, and it
 * costs one attribute and a step: no ray, no box, no furniture.
 */
export function farWindowMaterial(night: CityNight, kitGlass: THREE.Material | undefined): THREE.Material {
  const look = attribute<'vec3'>(ROOM_ATTRIBUTES.look, 'vec3')
  const lit = step(look.x, float(night.lit))
  const bulb = bulbOf(look.y, look.z)

  const material = new MeshStandardNodeMaterial()
  material.name = FAR_GLASS
  material.side = THREE.DoubleSide
  material.colorNode = mix(color(tintOf(kitGlass)), bulb.mul(float(LIT_WINDOW)), lit)
  material.roughnessNode = float(0.16)
  material.metalnessNode = float(0)
  material.emissiveNode = bulb.mul(lit).mul(float(LIT_WINDOW)).mul(float(night.level)).mul(float(GLOW))
  return material
}

/** The kit's own glass colour, which is what a window is when its room is dark. */
function tintOf(kitGlass: THREE.Material | undefined): number {
  return kitGlass instanceof THREE.MeshStandardMaterial ? kitGlass.color.getHex() : 0x414141
}
