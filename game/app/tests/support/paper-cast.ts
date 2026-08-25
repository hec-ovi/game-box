import type { Cast, CastMember } from '@gb/cast'
import * as THREE from 'three'

/** Something a body was asked to do, and whose body did it. */
export interface Moved {
  readonly object: THREE.Object3D
  readonly clip: string
}

/**
 * A body the way the art pack hands one over, with no art in it, keeping a note
 * of what it was asked to do.
 */
export class PaperBody implements CastMember {
  readonly npcId: string
  readonly object = new THREE.Object3D()
  readonly outfit = 'plain'
  readonly build = 'regular'
  readonly holding = undefined
  /** Every point they were asked to give their whole attention to, in order. */
  readonly attended: THREE.Vector3[] = []
  /** How many times they were sent back to the stance they were holding. */
  resumed = 0
  #moved: Moved[]
  #playing: string | undefined
  #gesturing: string | undefined
  #speaking = false

  constructor(npcId: string, moved: Moved[]) {
    this.npcId = npcId
    this.#moved = moved
  }

  get playing(): string | undefined {
    return this.#playing
  }

  get gesturing(): string | undefined {
    return this.#gesturing
  }

  get speaking(): boolean {
    return this.#speaking
  }

  get attending(): boolean {
    return this.attended.length > this.resumed
  }

  play(clip: string): void {
    this.#playing = clip
  }

  pace(): void {}

  gesture(clip: string): void {
    this.#gesturing = clip
    this.#moved.push({ object: this.object, clip })
  }

  stopGesture(): void {
    this.#gesturing = undefined
  }

  speak(on: boolean): void {
    this.#speaking = on
    this.#moved.push({ object: this.object, clip: on ? 'speaking' : 'quiet' })
  }

  pulse(): void {
    this.#moved.push({ object: this.object, clip: 'pulse' })
  }

  lookAt(): void {}
  lookAway(): void {}

  attend(point: THREE.Vector3): void {
    this.attended.push(point.clone())
  }

  resume(): void {
    this.resumed += 1
  }
}

/**
 * The art pack with no art in it: it still hands out a body per person, and
 * writes down what each one was asked to do. A room is dressed by its own
 * dressing, so the same person can be handed a second body for the room they
 * stand in; every body handed out is kept.
 */
export class PaperCast {
  readonly moved: Moved[] = []
  readonly spawned: PaperBody[] = []
  theme = ''

  spawn(npc: { id: string }): PaperBody {
    const made = new PaperBody(npc.id, this.moved)
    this.spawned.push(made)
    return made
  }

  update(): void {}

  /** Every body handed out under this id, in the order they were handed out. */
  bodies(npcId: string): PaperBody[] {
    return this.spawned.filter((body) => body.npcId === npcId)
  }

  /** As `@gb/cast` hands the loaded pack over. */
  get cast(): Cast {
    return this as unknown as Cast
  }
}
