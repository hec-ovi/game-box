import type { Npc } from '@gb/world'
import type { CrowdActor, CrowdCast } from '../../src/index.ts'

/** A body that records what the crowd did to it instead of rendering anything. */
export class FakeActor implements CrowdActor {
  readonly npc: Npc
  x = 0
  y = 0
  z = 0
  heading = 0
  clip = ''
  clips: string[] = []
  /** Every speed the gait was asked to run at, in metres per second, in the order it was asked. */
  paces: number[] = []
  released = false
  /** Every point the head was asked to look at, in the order it was asked. */
  looks: { x: number; y: number; z: number }[] = []
  looksAway = 0

  constructor(npc: Npc) {
    this.npc = npc
  }

  placeAt(x: number, y: number, z: number): void {
    this.x = x
    this.y = y
    this.z = z
  }

  faceTo(heading: number): void {
    this.heading = heading
  }

  play(clip: string): void {
    this.clip = clip
    this.clips.push(clip)
  }

  pace(metresPerSecond: number): void {
    this.paces.push(metresPerSecond)
  }

  lookAt(x: number, y: number, z: number): void {
    this.looks.push({ x, y, z })
  }

  lookAway(): void {
    this.looksAway++
  }

  release(): void {
    this.released = true
  }
}

/** The cast, without the art pack: hands out recorders and keeps every one it made. */
export class FakeCast implements CrowdCast {
  readonly made: FakeActor[] = []

  spawn(npc: Npc): CrowdActor {
    const actor = new FakeActor(npc)
    this.made.push(actor)
    return actor
  }

  get live(): FakeActor[] {
    return this.made.filter((actor) => !actor.released)
  }
}
