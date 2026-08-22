import type { Npc } from '@gb/world'
import * as THREE from 'three'
import { upperBodyOf } from './gesture.ts'
import { hash01 } from './hash.ts'
import { HeadLook } from './headlook.ts'

/** One person in the world: their body, what they are doing, and where they are looking. */
export interface CastMember {
  readonly npcId: string
  readonly object: THREE.Object3D
  /** The wardrobe entry they are wearing. */
  readonly outfit: string
  /** Cross-fade the whole body to a clip. Unknown names are ignored, never thrown. */
  play(clip: string, fadeSeconds?: number): void
  readonly playing: string | undefined
  /** Layer an upper-body clip over whatever is playing. Unknown names are ignored. */
  gesture(clip: string, fadeSeconds?: number): void
  stopGesture(fadeSeconds?: number): void
  readonly gesturing: string | undefined
  /** Turn the head toward a point in world space, and hold it there. */
  lookAt(point: THREE.Vector3): void
  lookAway(): void
}

export class Person implements CastMember {
  readonly npcId: string
  readonly object: THREE.Object3D
  readonly outfit: string

  #clips: ReadonlyMap<string, THREE.AnimationClip>
  #additive: Map<string, THREE.AnimationClip>
  #mixer: THREE.AnimationMixer
  #look: HeadLook
  #action: THREE.AnimationAction | undefined
  #playing: string | undefined
  #overlay: THREE.AnimationAction | undefined
  #gesturing: string | undefined

  constructor(
    npc: Npc,
    object: THREE.Object3D,
    outfit: string,
    clips: ReadonlyMap<string, THREE.AnimationClip>,
    additive: Map<string, THREE.AnimationClip>,
  ) {
    this.npcId = npc.id
    this.object = object
    this.outfit = outfit
    this.#clips = clips
    this.#additive = additive
    this.#mixer = new THREE.AnimationMixer(object)
    this.#look = new HeadLook(object)
  }

  get playing(): string | undefined {
    return this.#playing
  }

  get gesturing(): string | undefined {
    return this.#gesturing
  }

  play(name: string, fadeSeconds = 0.25): void {
    const clip = this.#clips.get(name)
    if (!clip || name === this.#playing) return
    const next = this.#mixer.clipAction(clip)
    next.reset()
    next.setLoop(THREE.LoopRepeat, Infinity)
    // start somewhere else in the loop so a room of people is not one person
    next.time = clip.duration * hash01(`${this.npcId}/${name}`)
    next.enabled = true
    next.setEffectiveWeight(1)
    if (this.#action) next.crossFadeFrom(this.#action, fadeSeconds, false)
    next.play()
    this.#action = next
    this.#playing = name
  }

  gesture(name: string, fadeSeconds = 0.3): void {
    if (name === this.#gesturing) return
    const clip = this.#masked(name)
    if (!clip) return
    this.stopGesture(fadeSeconds)
    const overlay = this.#mixer.clipAction(clip)
    overlay.blendMode = THREE.AdditiveAnimationBlendMode
    overlay.reset()
    overlay.setLoop(THREE.LoopRepeat, Infinity)
    overlay.time = clip.duration * hash01(`${this.npcId}/${name}#upper`)
    overlay.enabled = true
    overlay.setEffectiveWeight(1)
    overlay.fadeIn(fadeSeconds)
    overlay.play()
    this.#overlay = overlay
    this.#gesturing = name
  }

  stopGesture(fadeSeconds = 0.3): void {
    this.#overlay?.fadeOut(fadeSeconds)
    this.#overlay = undefined
    this.#gesturing = undefined
  }

  lookAt(point: THREE.Vector3): void {
    this.#look.at(point)
  }

  lookAway(): void {
    this.#look.away()
  }

  /** One frame: the clips first, then the layers that bend the result. */
  update(seconds: number): void {
    this.#mixer.update(seconds)
    if (this.#look.busy) this.#look.apply(seconds)
  }

  /** Masked clips are cut once and shared by everybody wearing the rig. */
  #masked(name: string): THREE.AnimationClip | undefined {
    const ready = this.#additive.get(name)
    if (ready) return ready
    const source = this.#clips.get(name)
    if (!source) return undefined
    const clip = upperBodyOf(source)
    if (clip) this.#additive.set(name, clip)
    return clip
  }
}
