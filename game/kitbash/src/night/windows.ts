import * as THREE from 'three'
import { color, float, fract, mix, positionWorld, smoothstep, uv } from 'three/tsl'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { GLASS } from '../catalog/pieces.ts'
import { roomBehindGlass } from './interior.ts'
import type { CityNight } from './night.ts'

/** How much brighter than its own colour a lit room burns through the glass. */
const GLOW = 2.4

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
  const tint = kitGlass instanceof THREE.MeshStandardMaterial ? kitGlass.color.getHex() : 0x414141

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
