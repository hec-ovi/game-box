import type { Hud } from '@gb/hud'
import type { PlayerState } from '@gb/play'
import type { QuestLog } from '@gb/quest'
import type { World } from '@gb/world'
import type { Buildings } from './buildings.ts'
import type { Companions } from './companions.ts'
import type { Player } from './player.ts'
import type { Reporting } from './reporting.ts'
import type { Talking } from './talking.ts'
import type { Target } from './targets.ts'

/**
 * What the player did and what it does. One key acts on whatever is in reach,
 * one click asks whoever is in reach to come along. Nothing here decides an
 * outcome: the quest log, the playthrough and the conversation do that.
 */
export class Interaction {
  #world: World
  #player: PlayerState
  #log: QuestLog
  #hud: Hud
  #body: Player
  #buildings: Buildings
  #talking: Talking
  #companions: Companions
  #report: Reporting
  #aimed: () => Target | undefined
  #element: HTMLElement

  constructor(input: {
    element: HTMLElement
    world: World
    player: PlayerState
    log: QuestLog
    hud: Hud
    body: Player
    buildings: Buildings
    talking: Talking
    companions: Companions
    report: Reporting
    aimed: () => Target | undefined
  }) {
    this.#element = input.element
    this.#world = input.world
    this.#player = input.player
    this.#log = input.log
    this.#hud = input.hud
    this.#body = input.body
    this.#buildings = input.buildings
    this.#talking = input.talking
    this.#companions = input.companions
    this.#report = input.report
    this.#aimed = input.aimed

    document.addEventListener('keydown', this.#key)
    this.#element.addEventListener('mousedown', this.#click)
  }

  dispose(): void {
    document.removeEventListener('keydown', this.#key)
    this.#element.removeEventListener('mousedown', this.#click)
  }

  #key = (event: KeyboardEvent): void => {
    const target = this.#aimed()
    if (event.code !== 'KeyE' || this.#hud.typing || this.#talking.active || !target) return
    // opening a conversation focuses its input, and without this the same
    // keystroke lands in it, so every chat starts with a stray e
    event.preventDefault()
    this.#act(target)
  }

  /** Clicking somebody asks them along, or tells them to stay. */
  #click = (event: MouseEvent): void => {
    const target = this.#aimed()
    if (event.button !== 0 || document.pointerLockElement === null) return
    if (this.#talking.active || target?.kind !== 'talk') return
    this.#companions.toggle(target.id, this.#body.position)
  }

  #act(target: Target): void {
    switch (target.kind) {
      case 'enter':
        this.#buildings.enter(target.id)
        break
      case 'leave':
        this.#buildings.leave()
        break
      case 'talk':
        void this.#talking.start(target.id)
        break
      case 'take':
        this.#take(target.id)
        break
    }
  }

  #take(itemId: string): void {
    const item = this.#world.item(itemId)
    if (!item || this.#buildings.outdoors) return

    this.#buildings.lift(itemId)
    const stolen = item.ownerNpcId !== undefined
    this.#player.take(itemId, { stolen })
    this.#hud.announce({ kind: 'item-taken', item: item.name })
    this.#report.report(this.#log.handle({ kind: 'acquired', itemId, stolen }))
  }
}
