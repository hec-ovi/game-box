import type { PlayerState } from '@gb/play'
import type { Objective, QuestLog } from '@gb/quest'
import type { World } from '@gb/world'
import type { Buildings } from './buildings.ts'
import type { Reporting } from './reporting.ts'
import type { Vec2 } from './walk.ts'

/** Somewhere in this room the player can put something they are carrying. */
export interface StashSpot {
  readonly anchorId: string
  readonly interiorId: string
  readonly itemId: string
  readonly itemName: string
  /** Where the spot is, in the room's own metres. */
  readonly at: Vec2
}

/**
 * Putting a thing down. A job that says to leave something somewhere names the
 * room and the surface in it, and the room was built with an empty object
 * standing at that surface, so the place to leave it is somewhere the player
 * walks up to and looks at rather than a button in a menu.
 *
 * Nothing here decides anything: the quest log says where a thing is wanted,
 * `@gb/play` lets go of it and the quest log is told it happened.
 */
export class Stashing {
  #world: World
  #log: QuestLog
  #player: PlayerState
  #buildings: Buildings
  #report: Reporting

  constructor(input: { world: World; log: QuestLog; player: PlayerState; buildings: Buildings; report: Reporting }) {
    this.#world = input.world
    this.#log = input.log
    this.#player = input.player
    this.#buildings = input.buildings
    this.#report = input.report
  }

  /**
   * Where a thing in the player's hands can be left, in the room they are
   * standing in. A spot only exists while all three hold: a live step wants
   * something left here, this is the room it wants it left in, and the player
   * is carrying one of the things that would satisfy it.
   */
  spots(): readonly StashSpot[] {
    const place = this.#buildings.place
    const built = this.#buildings.inside
    if (place.kind !== 'interior' || !built) return []

    const carrying = new Set(this.#player.inventory())
    const found: StashSpot[] = []
    for (const objective of this.#log.objectives()) {
      const anchorId = objective.anchorId
      // one spot answers one step: two jobs wanting the same shelf would
      // otherwise stack two prompts on one place with nothing to tell them apart
      if (!anchorId || found.some((spot) => spot.anchorId === anchorId)) continue
      if (!inHere(objective, place.interior.id)) continue

      const itemId = this.#carried(objective, carrying)
      const spot = itemId ? built.anchors.get(anchorId) : undefined
      if (!itemId || !spot) continue
      found.push({
        anchorId,
        interiorId: place.interior.id,
        itemId,
        itemName: this.#world.item(itemId)?.name ?? itemId,
        at: { x: spot.position.x, z: spot.position.z },
      })
    }
    return found
  }

  /**
   * Put it down. The spot is worked out again from live state at the moment the
   * key is pressed, so a thing handed over between the prompt appearing and the
   * player pressing does nothing at all rather than something else.
   */
  leave(anchorId: string): void {
    const spot = this.spots().find((each) => each.anchorId === anchorId)
    if (!spot) return

    const letGo = this.#player.drop(spot.itemId)
    if (!letGo.ok) return
    // and it is standing on that surface from here on, so the player can see
    // where they put it and can pick it back up
    this.#buildings.putDown(spot.itemId, anchorId)
    this.#report.note(`Left the ${spot.itemName.toLowerCase()}`)
    this.#report.report(
      this.#log.handle({ kind: 'stashed', itemId: spot.itemId, interiorId: spot.interiorId, anchorId }),
    )
  }

  /** Which of the things this step would take is actually in the player's hands. */
  #carried(objective: Objective, carrying: ReadonlySet<string>): string | undefined {
    const pool = [objective.itemId, ...(objective.alternates ?? [])]
    return pool.find((itemId): itemId is string => itemId !== undefined && carrying.has(itemId))
  }
}

/** Is this step asking for something to be left in the room the player is in? */
function inHere(objective: Objective, interiorId: string): boolean {
  const place = objective.place
  return place !== undefined && 'interiorId' in place && place.interiorId === interiorId
}
