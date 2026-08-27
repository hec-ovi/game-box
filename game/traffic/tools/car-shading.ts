import { BufferAttribute, Color, MeshStandardMaterial, type BufferGeometry, type Material, type Mesh } from 'three'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import { CAR_MATERIAL, surfaceOf } from '../src/pack-layout.ts'

/**
 * Turns one raw car mesh into something a renderer can shade: smooth normals
 * over the panels and hard ones along the real edges, and every material folded
 * into the vertices so the whole car is one draw.
 *
 * The source is triangle soup with smoothing switched off, which is why these
 * cars read as origami. Nothing in the file says which edges are meant to be
 * sharp, so it is worked out from the geometry: panels meeting shallower than
 * `CREASE` are one curved surface, sharper is a corner.
 */

/** Panels meeting at less than this are one surface. Radians. */
export const CREASE = (48 * Math.PI) / 180

/**
 * What a lens is painted, whichever pack it came from. A source bakes an unlit
 * lamp the muddy colour it is in daylight, and muddy is not what glows at night.
 */
export const LENS = { head: '#fff3e0', tail: '#e01008' } as const

/** One material for the whole pack: colour and surface ride on the vertices. */
export function packMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ name: CAR_MATERIAL, vertexColors: true, roughness: 0.5, metalness: 0.2 })
}

/** Smooth the panels, keep the corners. Non-indexed geometry is creased in place. */
export function crease(geometry: BufferGeometry): BufferGeometry {
  return toCreasedNormals(geometry, CREASE)
}

/**
 * Folds a mesh's material groups into a colour per vertex: base colour in RGB
 * and which of `CAR_SURFACES` it is in alpha, both as bytes, which is what
 * `COLOR_0` is in glTF. What is left is a geometry that needs no materials.
 */
export function bakeSurfaces(mesh: Mesh): void {
  const geometry = mesh.geometry
  if (geometry.index) throw new Error('bakeSurfaces: the groups of an indexed geometry are not vertex ranges')
  const worn = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  const count = geometry.getAttribute('position').count
  const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count, materialIndex: 0 }]

  const colours = new Uint8Array(count * 4)
  for (const group of groups) {
    const [r, g, b, surface] = swatch(worn[group.materialIndex ?? 0]!)
    for (let i = group.start; i < Math.min(group.start + group.count, count); i++) {
      colours[i * 4] = r
      colours[i * 4 + 1] = g
      colours[i * 4 + 2] = b
      colours[i * 4 + 3] = surface
    }
  }
  geometry.setAttribute('color', new BufferAttribute(colours, 4, true))
  geometry.clearGroups()
}

/**
 * One material as four bytes. The colour is stored the way glTF wants a vertex
 * colour, linear, so the shader can use it as it stands.
 */
function swatch(material: Material): [number, number, number, number] {
  const name = material.name
  const colour = new Color()
  if (name === 'Headlights') colour.set(LENS.head)
  else colour.copy((material as MeshStandardMaterial).color)
  const byte = (v: number): number => Math.max(0, Math.min(255, Math.round(v * 255)))
  return [byte(colour.r), byte(colour.g), byte(colour.b), surfaceOf(name)]
}
