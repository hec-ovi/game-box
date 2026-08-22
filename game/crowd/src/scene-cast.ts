import type { Cast, CastMember } from '@gb/cast'
import type { Npc } from '@gb/world'
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

  spawn(npc: Npc): CrowdActor {
    const { base, variant } = npc.appearance
    const body = this.#take(base, variant) ?? { member: this.#cast.spawn(npc), variant }
    body.member.object.visible = true
    this.root.add(body.member.object)
    return new BodyActor(body, this.root, (returned) => this.#park(base, returned))
  }

  /** The right look if one is parked, otherwise any body of the same kind, otherwise none. */
  #take(base: string, variant: number): Body | undefined {
    const bodies = this.#free.get(base)
    if (!bodies || bodies.length === 0) return undefined
    const exact = bodies.findIndex((body) => body.variant === variant)
    const index = exact === -1 ? bodies.length - 1 : exact
    return bodies.splice(index, 1)[0]
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

  release(): void {
    if (!this.#live) return
    this.#live = false
    this.#body.member.object.visible = false
    this.#root.remove(this.#body.member.object)
    this.#park(this.#body)
  }
}
