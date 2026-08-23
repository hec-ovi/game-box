import * as THREE from 'three'
import { float, pmremTexture, texture, vec3 } from 'three/tsl'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { FURNISH_STYLES, type FurnishStyle } from '../style/palette.ts'
import { patternNodes, planeMetres } from './pattern.ts'
import { roomProbe } from './probe.ts'
import { SURFACE_TEXTURES, lookOf, type SurfaceLook, type SurfacePart } from './surfaces.ts'
import type { SurfaceTextureId } from './surfaces.ts'
import { MetreTiling } from './tiling.ts'

/** The maps of one tiling surface, as the pack carries them. */
export interface SurfaceMaps {
  readonly map: THREE.Texture
  readonly normal: THREE.Texture | undefined
}

/** How wide a joint between two tiles is, and how far it takes to fade out. */
const JOINT = 0.006
const JOINT_SOFT = 0.004

/**
 * The floor, the walls and the ceiling, built out of the pack's two grain
 * images and the pattern each look is laid in, in both interior languages.
 *
 * Every room in town shares them: a material is built once per look and kept,
 * and the pools are fixed length, so a town of any size costs the same handful.
 * Each one carries the density its image is drawn at, so how big the room is
 * makes no difference to how big the grain or the tiles are in it.
 */
export class SurfaceLibrary {
  readonly #maps: ReadonlyMap<SurfaceTextureId, SurfaceMaps>
  readonly #materials = new Map<SurfaceLook, THREE.Material>()
  readonly #probes = new Map<FurnishStyle, THREE.DataTexture>()

  constructor(maps: ReadonlyMap<SurfaceTextureId, SurfaceMaps>) {
    for (const surface of maps.values()) {
      repeating(surface.map)
      repeating(surface.normal)
    }
    this.#maps = maps
    for (const style of FURNISH_STYLES) this.#probes.set(style, roomProbe(style))
  }

  /** One part of a room in one language, in the pattern and finish `choice` picks. */
  material(part: SurfacePart, style: FurnishStyle, choice = 0): THREE.Material {
    const look = lookOf(style, part, choice)
    let material = this.#materials.get(look)
    if (!material) {
      material = this.#build(look, style)
      this.#materials.set(look, material)
    }
    return material
  }

  /** What a room in that language has to reflect: its own light, as one small picture. */
  probe(style: FurnishStyle): THREE.DataTexture {
    return this.#probes.get(style)!
  }

  dispose(): void {
    for (const material of this.#materials.values()) material.dispose()
    for (const probe of this.#probes.values()) probe.dispose()
    for (const surface of this.#maps.values()) {
      surface.map.dispose()
      surface.normal?.dispose()
    }
  }

  #build(look: SurfaceLook, style: FurnishStyle): THREE.Material {
    const maps = this.#maps.get(look.map)
    const material = new MeshStandardNodeMaterial({
      name: look.name,
      metalness: 0,
      normalMap: maps?.normal ?? null,
    })
    if (look.normalScale !== undefined) material.normalScale.setScalar(look.normalScale)
    new MetreTiling(SURFACE_TEXTURES[look.map].metres).apply(material)
    paint(material, look, maps?.map, SURFACE_TEXTURES[look.map].grain)
    // the room's own light, so a polished floor has something to give back:
    // `scene.environment` indoors is the night sky and would leave it a hole
    material.envNode = pmremTexture(this.#probes.get(style)!)
    if (maps) MAPS.set(material, maps)
    return material
  }
}

const MAPS = new WeakMap<THREE.Material, SurfaceMaps>()

/** Which of the pack's images a surface material is made of, or nothing if it has none. */
export function mapsOf(material: THREE.Material): SurfaceMaps | undefined {
  return MAPS.get(material)
}

/**
 * The pattern and the finish, as nodes.
 *
 * The joint darkens and roughens the surface where two tiles meet; the tile's
 * own number shifts its colour and, on a printed wall, its gloss. Both ride on
 * the grain image rather than replacing it, so the surface still has grain in
 * it up close.
 */
function paint(
  material: MeshStandardNodeMaterial,
  look: SurfaceLook,
  map: THREE.Texture | undefined,
  grain: number,
): void {
  const { edge, cell } = patternNodes(look.pattern, planeMetres())
  const seam = look.joint > 0 ? edge.smoothstep(JOINT, JOINT + JOINT_SOFT).oneMinus() : float(0)
  const spread = cell.sub(0.5).mul(2)

  const colour = new THREE.Color().setHex(look.colour, THREE.SRGBColorSpace)
  const tint = vec3(colour.r, colour.g, colour.b)
    .mul(float(1).add(spread.mul(look.variation)))
    .mul(float(1).sub(seam.mul(look.joint)))

  // the image is grain, not a multiplier: divided by its own average it sits
  // around one, so the look's colour comes out on screen as the colour it names
  material.colorNode = map ? tint.mul(texture(map).rgb.div(grain).clamp(0.4, 1.8)) : tint
  material.roughnessNode = float(look.roughness)
    .add(spread.mul(look.sheen ?? 0))
    .add(seam.mul(look.joint * 0.4))
    .clamp(0.04, 1)
}

/** A tile that cannot repeat is one tile and a smear, whatever the pack's own sampler says. */
function repeating(texture: THREE.Texture | undefined): void {
  if (!texture) return
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  // a floor is seen at a grazing angle more than anything else in a room
  texture.anisotropy = 8
  texture.needsUpdate = true
}
