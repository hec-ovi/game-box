import type { CityNight } from '@gb/kitbash'
import * as THREE from 'three'
import { Fn, If, clamp, float, normalView, output, positionViewDirection, vec2, vec3, vec4 } from 'three/tsl'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { Bays } from './bays.ts'
import { layerIndex } from './layer.ts'
import { GLASS_MATERIAL_NAME } from './pack.ts'
import { surfaceFrame } from './surface.ts'

/**
 * The glass in every window of the city: one material, one draw.
 *
 * A pane is the windowed wall's own quads pushed `PANE.stand` off the wall, so
 * it carries the same uv and the same bay grid, and the room `InteriorWindows`
 * draws on the wall behind is seen through exactly the opening the pane
 * covers. Outside the opening the pane draws nothing, so the surround and the
 * mullions are the wall's.
 *
 * What it draws is what a thin sheet of glass does: reflect the environment by
 * its Fresnel share and let the rest through. The reflection is the standard
 * model's own, off `scene.environment` and whatever lights reach the pane, and
 * the composite is premultiplied by hand: the pane's light is added as it is
 * and the room behind is scaled by what the pane lets through. Face on that is
 * 96% of the room and a trace of sky; along the street it is mostly sky, which
 * is what a shop window does. After dark the sky is nearly black and the pane
 * catches the street instead, a fixed cool tone at the same grazing share, so
 * a facade seen along the pavement is a smear of wet road under neon rather
 * than a black wall.
 */
export const PANE = {
  /** Metres the pane stands off the wall. */
  stand: 0.02,
  /** Smooth: a pane holds a sharp reflection. */
  roughness: 0.06,
  /** What glass reflects face on. */
  reflectance: 0.04,
} as const

/** What a pane catches of the lit street after dark, when the sky it would reflect is black. */
const STREET: readonly [number, number, number] = [0.1, 0.15, 0.21]

export function glassMaterial(finishes: readonly string[], night: CityNight): THREE.Material {
  const bays = new Bays(finishes)
  const pane = Fn(() => {
    const frame = surfaceFrame()
    const layer = layerIndex()
    const out = vec2(0, 0).toVar()
    If(bays.windowed(layer), () => {
      const facing = clamp(positionViewDirection.dot(normalView), 0, 1)
      const fresnel = float(PANE.reflectance).add(float(1 - PANE.reflectance).mul(float(1).sub(facing).pow(5)))
      out.assign(vec2(bays.layout(layer, frame).share, fresnel))
    })
    return out
  })
  const seen = pane().toVar()
  const share = seen.x
  const fresnel = seen.y

  const material = new MeshStandardNodeMaterial()
  material.name = GLASS_MATERIAL_NAME
  material.colorNode = vec3(0, 0, 0)
  material.roughnessNode = float(PANE.roughness)
  material.metalnessNode = float(0)
  material.emissiveNode = vec3(STREET[0], STREET[1], STREET[2]).mul(fresnel).mul(night.level)
  material.opacityNode = share.mul(fresnel)
  // the pane's own light, over only the opening; the alpha is what it takes off the room behind
  material.outputNode = vec4(output.rgb.mul(share), output.a)
  material.transparent = true
  material.depthWrite = false
  material.fog = false
  material.blending = THREE.CustomBlending
  material.blendEquation = THREE.AddEquation
  material.blendSrc = THREE.OneFactor
  material.blendDst = THREE.OneMinusSrcAlphaFactor
  material.blendSrcAlpha = THREE.OneFactor
  material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor
  return material
}
