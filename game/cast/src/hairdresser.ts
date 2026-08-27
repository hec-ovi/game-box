import * as THREE from 'three'
import type { Look } from './look.ts'
import type { WardrobeEntry } from './wardrobe.ts'

/**
 * Puts a look on one cloned body: shows the one hairstyle and the one pair of
 * eyebrows, hides the rest, and colours everything the hair shader draws.
 *
 * Tinted materials are shared across everybody: a city costs one material per
 * colour per hair texture, not one per person or one per outfit, so the whole
 * palette is a few dozen materials however many people are on the street and
 * however many outfits they are wearing.
 */
export class Hairdresser {
  #tinted = new Map<string, THREE.Material>()

  /** How many tinted materials the whole cast is sharing. */
  get materials(): number {
    return this.#tinted.size
  }

  dress(body: THREE.Object3D, entry: WardrobeEntry, look: Look): void {
    const worn = new Set([look.style, look.brows, look.beard ? entry.beard : undefined])
    const pieces = new Set<string>([...entry.styles, ...entry.brows, ...(entry.beard ? [entry.beard] : [])])
    const shaders = new Set<string>()

    const meshes: THREE.Mesh[] = []
    body.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      meshes.push(mesh)
      if (!pieces.has(mesh.name)) return
      mesh.visible = worn.has(mesh.name)
      if (!Array.isArray(mesh.material)) shaders.add(mesh.material.name)
    })

    // matched by material name, not by identity: a loader hands out its own
    // copy of a material per mesh that needs one.
    //
    // A pair of brows is one sheet holding a brow row and a lash row, so it
    // takes a grown colour while the head may be out of a bottle: dyed to match,
    // acid green hair came with acid green eyelashes.
    const brows = new Set(entry.brows)
    for (const mesh of meshes) {
      if (Array.isArray(mesh.material) || !shaders.has(mesh.material.name)) continue
      mesh.material = this.#tint(mesh.material, brows.has(mesh.name) ? look.browColour : look.colour)
    }
  }

  /**
   * Keyed by the material's name, not its identity: every character file
   * carries its own copy of the same two hair materials, built from the same
   * source texture, so one tinted copy serves the whole cast.
   */
  #tint(material: THREE.Material, colour: string): THREE.Material {
    const key = `${material.name}/${colour}`
    const ready = this.#tinted.get(key)
    if (ready) return ready
    const tinted = material.clone()
    ;(tinted as THREE.MeshStandardMaterial).color = new THREE.Color(colour)
    tinted.name = material.name
    this.#tinted.set(key, tinted)
    return tinted
  }
}
