import type { Npc } from '@gb/world'
import * as THREE from 'three'
import { CLIPS, GAITS, GESTURES } from './clips.ts'
import { Facing } from './facing.ts'
import { upperBodyOf } from './gesture.ts'
import { hash01 } from './hash.ts'
import { HeadLook } from './headlook.ts'
import { Hands } from './hands.ts'
import { busyHandsOf, type Hand } from './props/handheld.ts'
import type { Props } from './props/props.ts'
import { seatedIdleOf, stanceOf } from './stance.ts'

/** One person in the world: their body, what they are doing, and where they are looking. */
export interface CastMember {
  readonly npcId: string
  readonly object: THREE.Object3D
  /** The wardrobe entry they are wearing. */
  readonly outfit: string
  /** Cross-fade the whole body to a clip. Unknown names are ignored, never thrown. */
  play(clip: string, fadeSeconds?: number): void
  readonly playing: string | undefined
  /** Whatever the playing clip is posed around, in their hand; nothing for a clip that holds nothing. */
  readonly holding: THREE.Object3D | undefined
  /** Run a moving clip at the speed the body is really moving. Does nothing to a clip that is not a gait. */
  pace(metresPerSecond: number): void
  /** Layer one of the `GESTURES` over whatever is playing. Any other name is ignored. */
  gesture(clip: string, fadeSeconds?: number): void
  stopGesture(fadeSeconds?: number): void
  readonly gesturing: string | undefined
  /** Turn the head toward a point in world space, and hold it there. */
  lookAt(point: THREE.Vector3): void
  lookAway(): void
  /** Leave the stance and give a point the whole body's attention. The position never moves. */
  attend(point: THREE.Vector3): void
  /** Go back to the stance `attend` left. */
  resume(): void
  readonly attending: boolean
}

/**
 * A gait played slower than this drops into slow motion and faster than this
 * into a flicker, so the feet are let skate past these instead. The ceiling is
 * set by the street: its briskest walkers move at 1.61 m/s over walks authored
 * at 0.98, and at 1.65 a walk is 2.5 steps a second with the feet still planted.
 */
const PACE_RANGE = { slowest: 0.7, fastest: 1.65 }

/** Past this angle off the way a seated body faces, the head cannot reach and the body stands up. */
const BEHIND = (100 * Math.PI) / 180

export class Person implements CastMember {
  readonly npcId: string
  readonly object: THREE.Object3D
  readonly outfit: string

  #clips: ReadonlyMap<string, THREE.AnimationClip>
  #additive: Map<string, THREE.AnimationClip>
  #mixer: THREE.AnimationMixer
  #look: HeadLook
  #facing: Facing
  #hands: Hands
  #action: THREE.AnimationAction | undefined
  #playing: string | undefined
  #overlay: THREE.AnimationAction | undefined
  #gesturing: string | undefined
  #stance: string | undefined
  #stoodUp = false
  #then: (() => void) | undefined

  /**
   * `object` is what the game moves and turns; `body` is the art inside it,
   * held at the turn that makes the character face the way the game expects.
   * Everything that reads the rig reads the body, so the turn cancels out.
   */
  constructor(
    npc: Npc,
    object: THREE.Object3D,
    body: THREE.Object3D,
    outfit: string,
    clips: ReadonlyMap<string, THREE.AnimationClip>,
    additive: Map<string, THREE.AnimationClip>,
    props: Props,
  ) {
    this.npcId = npc.id
    this.object = object
    this.outfit = outfit
    this.#clips = clips
    this.#additive = additive
    this.#mixer = new THREE.AnimationMixer(body)
    this.#mixer.addEventListener('finished', () => this.#finished())
    this.#look = new HeadLook(body)
    this.#facing = new Facing(body, body.rotation.y)
    this.#hands = new Hands(body, props)
  }

  get playing(): string | undefined {
    return this.#playing
  }

  get holding(): THREE.Object3D | undefined {
    return this.#hands.holding
  }

  get gesturing(): string | undefined {
    return this.#gesturing
  }

  get attending(): boolean {
    return this.#stance !== undefined
  }

  play(name: string, fadeSeconds = 0.25): void {
    // an order from outside ends whatever attend was doing
    this.#stance = undefined
    this.#stoodUp = false
    this.#then = undefined
    this.#start(name, fadeSeconds, THREE.LoopRepeat)
  }

  pace(metresPerSecond: number): void {
    const authored = this.#playing && GAITS[this.#playing]
    if (!authored || !this.#action) return
    this.#action.timeScale = Math.min(PACE_RANGE.fastest, Math.max(PACE_RANGE.slowest, metresPerSecond / authored))
  }

  gesture(name: string, fadeSeconds = 0.3): void {
    if (name === this.#gesturing || !GESTURES.includes(name)) return
    const clip = this.#masked(name, this.#playing ? busyHandsOf(this.#playing) : [])
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

  attend(point: THREE.Vector3): void {
    if (!this.#playing) return
    this.#stance ??= this.#playing
    this.#look.at(point)
    switch (stanceOf(this.#stance)) {
      case 'lying':
        return
      case 'seated':
        if (this.#stoodUp || this.#behind(point)) {
          this.#facing.toward(point)
          this.#standUp()
        } else if (this.#playing === this.#stance) {
          this.#start(seatedIdleOf(this.#stance), 0.4, THREE.LoopRepeat)
        }
        return
      case 'standing':
        this.#facing.toward(point)
        if (this.#playing === this.#stance) this.#start(CLIPS.idle, 0.4, THREE.LoopRepeat)
    }
  }

  resume(): void {
    const stance = this.#stance
    if (!stance) return
    this.#stance = undefined
    this.#look.away()
    this.#facing.ahead()
    if (this.#stoodUp) {
      this.#stoodUp = false
      this.#start(CLIPS.sitDown, 0.3, THREE.LoopOnce, () => this.#start(stance, 0.2, THREE.LoopRepeat))
      return
    }
    this.#start(stance, 0.4, THREE.LoopRepeat)
  }

  /** One frame: the clips first, then the layers that bend the result. */
  update(seconds: number): void {
    this.#mixer.update(seconds)
    if (this.#facing.busy) this.#facing.apply(seconds)
    if (this.#look.busy) this.#look.apply(seconds)
  }

  #standUp(): void {
    if (this.#stoodUp) return
    this.#stoodUp = true
    this.#start(CLIPS.standUp, 0.3, THREE.LoopOnce, () => this.#start(CLIPS.idle, 0.2, THREE.LoopRepeat))
  }

  /** Is the point past what a seated head can turn to? */
  #behind(point: THREE.Vector3): boolean {
    this.object.updateWorldMatrix(true, false)
    const local = this.object.worldToLocal(point.clone())
    // the object faces -Z at yaw 0
    return Math.abs(Math.atan2(-local.x, -local.z)) > BEHIND
  }

  #start(name: string, fadeSeconds: number, loop: THREE.AnimationActionLoopStyles, then?: () => void): void {
    const clip = this.#clips.get(name)
    if (!clip || name === this.#playing) return
    const next = this.#mixer.clipAction(clip)
    next.reset()
    next.timeScale = 1
    next.setLoop(loop, loop === THREE.LoopOnce ? 1 : Infinity)
    next.clampWhenFinished = loop === THREE.LoopOnce
    // start somewhere else in the loop so a room of people is not one person
    next.time = loop === THREE.LoopOnce ? 0 : clip.duration * hash01(`${this.npcId}/${name}`)
    next.enabled = true
    next.setEffectiveWeight(1)
    if (this.#action) next.crossFadeFrom(this.#action, fadeSeconds, false)
    next.play()
    this.#action = next
    this.#playing = name
    this.#then = then
    this.#hands.forClip(name)
  }

  #finished(): void {
    const then = this.#then
    this.#then = undefined
    then?.()
  }

  /** Masked clips are cut once and shared by everybody wearing the rig. */
  #masked(name: string, sparing: readonly Hand[]): THREE.AnimationClip | undefined {
    const key = [name, ...sparing].join('/')
    const ready = this.#additive.get(key)
    if (ready) return ready
    const source = this.#clips.get(name)
    if (!source) return undefined
    const clip = upperBodyOf(source, sparing)
    if (clip) this.#additive.set(key, clip)
    return clip
  }
}
