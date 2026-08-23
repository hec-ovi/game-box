import { CLIPS, GESTURES, clipsUsed, type CastMember } from '@gb/cast'
import type { Npc } from '@gb/world'
import * as THREE from 'three'
import type { CastSpawner } from '../../src/index.ts'

/** Every clip name the shipped pack carries, so the stub can ignore a name the way the cast does. */
const LIBRARY = new Set(clipsUsed())

/** The clips that may be layered over the base one, so the stub refuses the rest the way the cast does. */
const LAYERS = new Set(GESTURES)

/**
 * One person without the art pack: an empty object for a body, and the same
 * promises `@gb/cast` makes. A body is spawned already playing something, and
 * a name the library does not have is ignored, so `playing` is only ever a
 * clip that exists: if the crowd asks for a name nobody has, this member is
 * left in the pose it had, which is what a test for the rest pose reads.
 */
export class StubMember implements CastMember {
  readonly npcId: string
  readonly object = new THREE.Object3D()
  readonly outfit = 'stub'
  #playing: string | undefined
  #gesturing: string | undefined

  constructor(npc: Npc, doing: string) {
    this.npcId = npc.id
    this.object.name = `${npc.appearance.base}/${npc.appearance.variant}`
    this.play(doing)
  }

  get playing(): string | undefined {
    return this.#playing
  }

  get gesturing(): string | undefined {
    return this.#gesturing
  }

  play(clip: string): void {
    if (LIBRARY.has(clip)) this.#playing = clip
  }

  gesture(clip: string): void {
    if (LAYERS.has(clip)) this.#gesturing = clip
  }

  stopGesture(): void {
    this.#gesturing = undefined
  }

  lookAt(): void {}
  lookAway(): void {}
}

/** The cast without the art pack: same `spawn`, and every body it made kept for reading. */
export class StubCast implements CastSpawner {
  readonly spawned: Npc[] = []
  readonly members: StubMember[] = []

  spawn(npc: Npc, doing: string = CLIPS.idle): CastMember {
    this.spawned.push(npc)
    const member = new StubMember(npc, doing)
    this.members.push(member)
    return member
  }
}
