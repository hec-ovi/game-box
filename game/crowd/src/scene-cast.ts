import type { Cast, CastMember } from '@gb/cast'
import type { Npc } from '@gb/world'
import { Vector3 } from 'three'
import type { Object3D } from 'three'
import type { CrowdActor, CrowdCast } from './ports.ts'

/** The part of `@gb/cast` the crowd uses. A test can stand in for it without the art pack. */
export type CastSpawner = Pick<Cast, 'spawn'>

interface Body {
  readonly member: CastMember
  readonly variant: number
}

/**
 * The bridge from the crowd to the real people: a `@gb/cast` body per walker,
 * parented to one object you can add to the scene and hide in one go.
 *
 * Bodies are recycled rather than thrown away. `@gb/cast` keeps a mixer per
 * body it spawns and has no way to hand one back, so an hour of walking past
 * strangers would otherwise leave hundreds of skeletons ticking. A retired
 * body leaves the scene graph and waits here for the next walker of its kind.
 */
export class SceneCast implements CrowdCast {
  readonly root: Object3D
  #cast: CastSpawner
  #free = new Map<string, Body[]>()
  /** The body each person out here is wearing, by their NPC id. */
  #worn = new Map<string, CastMember>()

  constructor(cast: CastSpawner, root: Object3D) {
    this.#cast = cast
    this.root = root
  }

  /** Bodies parked for reuse. Grows to the busiest moment the player has seen, then stops. */
  get parked(): number {
    let total = 0
    for (const bodies of this.#free.values()) total += bodies.length
    return total
  }

  /**
   * The bodies out here right now, by the id of whoever is wearing one: how
   * the game reaches a walker to make them talk with their hands. Same
   * question, same shape as `@gb/cast`'s `CastDressing.members()`, which
   * answers it for the people standing at posts indoors.
   *
   * Live, and never worth keeping hold of. A retired body is parked and worn
   * by the next passer-by, so a member kept past its walker is somebody else's
   * arms: look the id up again every time you want it.
   */
  members(): ReadonlyMap<string, CastMember> {
    return this.#worn
  }

  spawn(npc: Npc): CrowdActor {
    const { base, variant } = npc.appearance
    const body = this.#take(base, variant) ?? { member: this.#cast.spawn(npc), variant }
    body.member.object.visible = true
    this.root.add(body.member.object)
    this.#worn.set(npc.id, body.member)
    return new BodyActor(body, this.root, (returned) => this.#give(npc.id, base, returned))
  }

  /** The right look if one is parked, otherwise any body of the same kind, otherwise none. */
  #take(base: string, variant: number): Body | undefined {
    const bodies = this.#free.get(base)
    if (!bodies || bodies.length === 0) return undefined
    const exact = bodies.findIndex((body) => body.variant === variant)
    const index = exact === -1 ? bodies.length - 1 : exact
    return bodies.splice(index, 1)[0]
  }

  /** A body handed back: nobody is wearing it, and it waits for the next walker of its kind. */
  #give(npcId: string, base: string, body: Body): void {
    // spawn one person twice and the newest body is theirs: an older one going home must not blank it
    if (this.#worn.get(npcId) === body.member) this.#worn.delete(npcId)
    this.#park(base, body)
  }

  #park(base: string, body: Body): void {
    const bodies = this.#free.get(base)
    if (bodies) bodies.push(body)
    else this.#free.set(base, [body])
  }
}

class BodyActor implements CrowdActor {
  #body: Body
  #root: Object3D
  #park: (body: Body) => void
  #live = true
  /** Where this body is looking, its own so the cast may hold on to it. */
  #eye = new Vector3()

  constructor(body: Body, root: Object3D, park: (body: Body) => void) {
    this.#body = body
    this.#root = root
    this.#park = park
  }

  placeAt(x: number, y: number, z: number): void {
    if (this.#live) this.#body.member.object.position.set(x, y, z)
  }

  faceTo(heading: number): void {
    if (this.#live) this.#body.member.object.rotation.y = heading
  }

  play(clip: string): void {
    if (this.#live) this.#body.member.play(clip)
  }

  lookAt(x: number, y: number, z: number): void {
    if (!this.#live) return
    this.#eye.set(x, y, z)
    this.#body.member.lookAt(this.#eye)
  }

  lookAway(): void {
    if (this.#live) this.#body.member.lookAway()
  }

  release(): void {
    if (!this.#live) return
    this.#live = false
    // a parked body is reused as somebody else: it must not come back still staring, or still waving its hands about
    this.#body.member.lookAway()
    this.#body.member.stopGesture()
    this.#body.member.object.visible = false
    this.#root.remove(this.#body.member.object)
    this.#park(this.#body)
  }
}
