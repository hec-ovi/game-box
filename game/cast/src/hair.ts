import * as THREE from 'three'
import { hash01 } from './hash.ts'
import type { WardrobeEntry } from './wardrobe.ts'

/**
 * What the tint multiplies the hair texture by. The pack draws hair, beards
 * and eyebrows as one greyscale strand map meant to be coloured by the
 * material, so the material's own colour is what makes hair hair: left at
 * white it comes out the grey of the map, on the head and on the brows alike.
 *
 * These read brighter than the hair they make, because a mid-grey map halves
 * them: black, three browns, two blondes, red, grey, white.
 */
const COLOURS = [
  '#3b3531',
  '#5f4632',
  '#8a6743',
  '#a8845a',
  '#c2a06a',
  '#eed9a6',
  '#a8552e',
  '#b8b2a8',
  '#f2efe9',
] as const

/** How often somebody with a beard available grows one. */
const BEARDED = 0.35

/** One person's hair: the style, the brows, whether they have a beard, and the colour of all three. */
export interface Look {
  /** The hairstyle node to show, or undefined for a bald head. */
  readonly style: string | undefined
  /** The eyebrow node to show. */
  readonly brows: string | undefined
  readonly beard: boolean
  readonly colour: string
}

/**
 * Which hair an NPC wears. Bald is one of the choices rather than the only
 * one, so a street has a mix, and the colour is drawn separately from the cut
 * so the same cut turns up in every colour. The same id always gets the same
 * hair, in this session and in anyone else's.
 */
export function chooseLook(entry: WardrobeEntry, npcId: string): Look {
  const cuts: Array<string | undefined> = [...entry.styles, undefined]
  return {
    style: pick(cuts, npcId, 'hair'),
    brows: pick(entry.brows, npcId, 'brows'),
    beard: Boolean(entry.beard) && hash01(`${npcId}/beard`) < BEARDED,
    colour: pick(COLOURS, npcId, 'hair-colour')!,
  }
}

function pick<T>(options: readonly T[], npcId: string, what: string): T | undefined {
  if (!options.length) return undefined
  return options[Math.floor(hash01(`${npcId}/${what}`) * options.length)]
}

/**
 * Puts a look on one cloned body: shows the one hairstyle and the one pair of
 * eyebrows, hides the rest, and colours everything the hair shader draws.
 *
 * Tinted materials are shared across everybody: a city costs one material per
 * colour per hair texture, not one per person, so the whole palette is a
 * couple of dozen materials however many people are on the street.
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
    // copy of a material per mesh that needs one
    for (const mesh of meshes) {
      if (Array.isArray(mesh.material) || !shaders.has(mesh.material.name)) continue
      mesh.material = this.#tint(mesh.material, look.colour)
    }
  }

  #tint(material: THREE.Material, colour: string): THREE.Material {
    const key = `${material.uuid}/${colour}`
    const ready = this.#tinted.get(key)
    if (ready) return ready
    const tinted = material.clone()
    ;(tinted as THREE.MeshStandardMaterial).color = new THREE.Color(colour)
    tinted.name = material.name
    this.#tinted.set(key, tinted)
    return tinted
  }
}
