import type { CityNight } from '@gb/kitbash'
import * as THREE from 'three'
import { Fn, If, float, floor, hash, int, mix, step, texture, uniformArray, uv, vec2, vec4 } from 'three/tsl'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { Bays } from './bays.ts'
import { SCREEN } from './display.ts'
import { ROOM } from './interior.ts'
import { layerIndex } from './layer.ts'
import type { ScreenTint } from './lights.ts'
import { SURFACE, type PrefabAtlas } from './material.ts'
import { GLOW, SHELL_MATERIAL_NAME } from './pack.ts'
import { ROOM_TINTS } from './rooms.ts'
import { DISPLAY_FINISH, SCREEN_PICTURES } from './screens.ts'
import { surfaceFrame } from './surface.ts'
import { stretchOf } from './wall.ts'

/**
 * A building as seen from far off: the same walls, the same pictures, and
 * nothing that is only worth drawing near.
 *
 * `@gb/scene` batches every plot's shell at open and dresses only the buildings
 * round the player, so this is what most of the town is drawn with at any
 * moment. It costs the wall fetch and arithmetic: the windows are the same
 * bays the detail cuts, lit in the same order by the same hash and in the same
 * tint, but each is a flat lit rectangle rather than a room, so the skyline
 * keeps its lit windows without a raymarch or a room fetch; a screen is the
 * mean colour of the picture the plot carries, which is what a lit board is
 * from across the town. No glass stands in front of it and no sign hangs on it.
 *
 * It keeps the roughness and drops the relief, which is the split that costs
 * nothing: how glossy a material is decides the shape of the highlight a sign
 * or a lamp lays down its whole face, and it comes off a `uniformArray` of one
 * float per finish. A normal map is texel detail, gone in the mips by the time
 * a building is far enough to be a shell, and it would be a second fetch on
 * every plot in town.
 */

/** What a lit window is worth, flat, against the room the detail draws behind it. */
const LIT_WINDOW = 0.42

/** A room with its lights off, from across the town. */
const UNLIT = 0.05

export function shellMaterial(atlas: PrefabAtlas, night: CityNight, tints: readonly ScreenTint[]): THREE.Material {
  const layer = layerIndex()
  const stretch = uniformArray<'float'>(atlas.finishes.map(stretchOf), 'float')
  const at = uv().mul(vec2(1, stretch.element(layer)))
  const wall = texture(atlas.colour, at).depth(layer)
  const burning = texture(atlas.emissive, at).depth(layer).rgb.mul(float(GLOW))

  // one float a finish, so a far glazed tile is still glass and a far precast
  // wall is still concrete, at no fetch
  const rough = uniformArray<'float'>(
    atlas.finishes.map((_, at) => atlas.roughness?.[at] ?? SURFACE.roughness),
    'float',
  )
  const bays = new Bays(atlas.finishes)
  const roomTints = uniformArray<'vec3'>(ROOM_TINTS.map(([r, g, b]) => new THREE.Vector3(r, g, b)), 'vec3')
  const screenTints = uniformArray<'vec3'>(tints.map((tint) => new THREE.Color(tint.colour).multiplyScalar(tint.brightness)), 'vec3')
  const display = atlas.finishes.indexOf(DISPLAY_FINISH)

  // what glows here and how much of the fragment it covers: a flat lit window
  // in its room's tint, or a screen in its picture's mean colour
  const lit = Fn(() => {
    const frame = surfaceFrame()
    const out = vec4(0, 0, 0, 0).toVar()
    If(bays.windowed(layer), () => {
      const bay = bays.layout(layer, frame)
      const seed = bay.id.x.mul(1973).add(bay.id.y.mul(9277)).add(1)
      const on = step(hash(seed).mul(bay.keys), night.lit)
      const tint = roomTints.element(floor(hash(seed.add(3121)).mul(ROOM_TINTS.length)).toInt())
      out.assign(vec4(tint.mul(mix(float(UNLIT), float(LIT_WINDOW), on)), bay.share))
    })
    if (display >= 0) {
      If(layer.equal(int(display)), () => {
        const shift = floor(uv().x)
        const picture = shift.sub(floor(shift.div(SCREEN_PICTURES.length)).mul(SCREEN_PICTURES.length)).toInt()
        out.assign(vec4(screenTints.element(picture), 1))
      })
    }
    return out
  })
  const seen = lit().toVar()
  const screen = display >= 0 ? layer.equal(int(display)).select(float(1), float(0)) : float(0)
  const strength = mix(float(ROOM.glow), float(SCREEN.glow), screen)
  const albedo = mix(float(ROOM.albedo), float(SCREEN.albedo), screen)

  const material = new MeshStandardNodeMaterial()
  material.name = SHELL_MATERIAL_NAME
  material.colorNode = mix(wall.rgb, seen.rgb.mul(albedo), seen.a)
  material.emissiveNode = mix(burning, seen.rgb.mul(strength), seen.a).mul(night.level)
  material.roughnessNode = rough.element(layer)
  material.metalnessNode = float(SURFACE.metalness)
  return material
}
