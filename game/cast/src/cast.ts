import type { AnchorKind, BodyKind, Npc } from '@gb/world'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import { CLIP_FOR_ANCHOR, CLIPS } from './clips.ts'

export type CastError =
  | { readonly code: 'unreadable-asset'; readonly what: string; readonly message: string }
  | { readonly code: 'missing-clip'; readonly clips: readonly string[] }
  | { readonly code: 'rig-mismatch'; readonly body: string; readonly message: string }

export interface CastSource {
  /** The shared clip library. */
  readonly anims: ArrayBuffer
  /** One body per `BODY_KIND`. */
  readonly bodies: Readonly<Partial<Record<BodyKind, ArrayBuffer>>>
  /** Clothes, by outfit name. Parts bind to the same skeleton as the bodies. */
  readonly outfits?: Readonly<Record<string, ArrayBuffer>>
}

export interface CastMember {
  readonly npcId: string
  readonly object: THREE.Object3D
  /** Cross-fade to a clip. Unknown names are ignored, never thrown. */
  play(clip: string, fadeSeconds?: number): void
  readonly playing: string | undefined
}

/**
 * The people. One clip library and one body per kind are loaded once, then
 * every NPC is a clone sharing that geometry with its own skeleton and its own
 * mixer. Nothing here decides who stands where: it makes a person and plays
 * what they are doing.
 */
export class Cast {
  #clips = new Map<string, THREE.AnimationClip>()
  #bodies = new Map<BodyKind, THREE.Object3D>()
  #outfits = new Map<string, THREE.SkinnedMesh[]>()
  #mixers: THREE.AnimationMixer[] = []

  private constructor() {}

  static async load(source: CastSource): Promise<Cast> {
    const cast = new Cast()
    // the shipped assets are meshopt-compressed: 29 KB of decoder against
    // three quarters off the wire size
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)

    const anims = await parse(loader, source.anims, 'the clip library')
    for (const clip of anims.animations) cast.#clips.set(clip.name, clip)

    for (const [kind, buffer] of Object.entries(source.bodies) as Array<[BodyKind, ArrayBuffer]>) {
      const body = await parse(loader, buffer, `the ${kind} body`)
      cast.#bodies.set(kind, body.scene)
    }

    for (const [name, buffer] of Object.entries(source.outfits ?? {})) {
      const outfit = await parse(loader, buffer, `the ${name} outfit`)
      const parts: THREE.SkinnedMesh[] = []
      outfit.scene.traverse((child) => {
        if ((child as THREE.SkinnedMesh).isSkinnedMesh) parts.push(child as THREE.SkinnedMesh)
      })
      cast.#outfits.set(name, parts)
    }
    return cast
  }

  outfits(): readonly string[] {
    return [...this.#outfits.keys()]
  }

  clips(): readonly string[] {
    return [...this.#clips.keys()]
  }

  bodies(): readonly BodyKind[] {
    return [...this.#bodies.keys()]
  }

  has(clip: string): boolean {
    return this.#clips.has(clip)
  }

  /** A person, standing at the origin facing north, already doing something. */
  spawn(npc: Npc, doing: string = CLIPS.idle): CastMember {
    const source = this.#bodies.get(npc.appearance.base) ?? [...this.#bodies.values()][0]
    if (!source) throw new Error('the cast has no bodies loaded')

    const object = cloneSkinned(source)
    object.name = npc.id
    object.userData.npcId = npc.id
    this.#dress(object, npc)

    const mixer = new THREE.AnimationMixer(object)
    this.#mixers.push(mixer)

    let playing: string | undefined
    let action: THREE.AnimationAction | undefined

    const member: CastMember = {
      npcId: npc.id,
      object,
      get playing() {
        return playing
      },
      play: (name, fadeSeconds = 0.25) => {
        const clip = this.#clips.get(name)
        if (!clip || name === playing) return
        const next = mixer.clipAction(clip)
        next.reset()
        next.setLoop(THREE.LoopRepeat, Infinity)
        // start somewhere else in the loop so a room of people is not one person
        next.time = clip.duration * hash01(`${npc.id}/${name}`)
        next.enabled = true
        next.setEffectiveWeight(1)
        if (action) next.crossFadeFrom(action, fadeSeconds, false)
        next.play()
        action = next
        playing = name
      },
    }
    member.play(doing, 0)
    return member
  }

  /**
   * Puts clothes on. The parts were rigged to the same skeleton as the body,
   * so they only have to be bound to this person's copy of it.
   */
  #dress(object: THREE.Object3D, npc: Npc): void {
    let host: THREE.SkinnedMesh | undefined
    object.traverse((child) => {
      const skinned = child as THREE.SkinnedMesh
      if (skinned.isSkinnedMesh && !host) host = skinned
    })
    const skeleton = host?.skeleton

    const names = [...this.#outfits.keys()].filter((name) =>
      name.toLowerCase().startsWith(npc.appearance.base === 'female' ? 'female' : 'male'),
    )
    const outfit = names.length ? names[Math.floor(hash01(npc.id) * names.length)]! : undefined
    const parts = outfit ? this.#outfits.get(outfit) : undefined
    if (!host || !skeleton || !parts) return

    for (const part of parts) {
      const worn = new THREE.SkinnedMesh(part.geometry, part.material)
      worn.name = part.name
      worn.frustumCulled = false
      worn.castShadow = true
      // a sibling of the body's own skinned mesh, so the transform above them
      // is the same one, and bound with the body's bind matrix
      ;(host.parent ?? object).add(worn)
      worn.bind(skeleton, host.bindMatrix)
    }
    object.userData.outfit = outfit
  }

  /** What somebody stationed on this kind of anchor is doing. */
  static doingAt(anchorKind: AnchorKind): string {
    return CLIP_FOR_ANCHOR[anchorKind]
  }

  update(seconds: number): void {
    for (const mixer of this.#mixers) mixer.update(seconds)
  }
}

async function parse(loader: GLTFLoader, buffer: ArrayBuffer, what: string) {
  return new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((resolve, reject) => {
    loader.parse(
      buffer,
      '',
      (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations }),
      (cause) => reject(new Error(`${what}: ${String(cause)}`)),
    )
  })
}

/** A stable number in [0,1) from a string. */
function hash01(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}
