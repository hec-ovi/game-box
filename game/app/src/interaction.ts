import type { Driving } from '@gb/drive'
import type { Hud } from '@gb/hud'
import type { PlayerState } from '@gb/play'
import type { QuestLog } from '@gb/quest'
import type { World } from '@gb/world'
import type { Buildings } from './buildings.ts'
import { typingSomewhere } from './focus.ts'
import type { Companions } from './companions.ts'
import type { Conditions } from './conditions.ts'
import type { Guide } from './guide.ts'
import type { Player } from './player.ts'
import type { Reporting } from './reporting.ts'
import type { Stashing } from './stashing.ts'
import type { Talking } from './talking.ts'
import type { Target } from './targets.ts'

/**
 * What the player did and what it does. One key acts on whatever is in reach,
 * one click asks whoever is in reach to come along, and the rest ask for the
 * way somewhere or turn the hour and the weather over. Nothing here decides an
 * outcome: the quest log, the playthrough, the conversation, the guide and the
 * clock do that, and this reports back whatever they said.
 */
export class Interaction {
  #world: World
  #player: PlayerState
  #log: QuestLog
  #hud: Hud
  #body: Player
  #buildings: Buildings
  #stashing: Stashing
  #talking: Talking
  #companions: Companions
  #driving: Driving
  #guide: Guide
  #conditions: Conditions
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
    stashing: Stashing
    talking: Talking
    companions: Companions
    driving: Driving
    guide: Guide
    conditions: Conditions
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
    this.#stashing = input.stashing
    this.#talking = input.talking
    this.#companions = input.companions
    this.#driving = input.driving
    this.#guide = input.guide
    this.#conditions = input.conditions
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
    if (this.#elsewhere() || event.metaKey || event.ctrlKey || event.altKey) return

    if (event.code === 'KeyE') {
      const target = this.#aimed()
      if (!target) return
      // opening a conversation focuses its input, and without this the same
      // keystroke lands in it, so every chat starts with a stray e
      event.preventDefault()
      this.#act(target)
      return
    }

    const said = this.#asked(event.code)
    if (said) this.#report.note(said)
  }

  /**
   * Whose keys these are. The game binds on the document, so anything else on
   * the page that is taking what the player types has to be asked first: the
   * conversation, the boot panel while it has the keys, and any text box
   * anywhere. Without it, naming a city drives the city underneath it.
   */
  #elsewhere(): boolean {
    return this.#hud.typing || this.#talking.active || this.#body.typing || typingSomewhere()
  }

  /** The keys that ask something rather than act on something in reach. */
  #asked(code: string): string | undefined {
    switch (code) {
      case 'KeyG':
        return this.#guide.say()
      case 'KeyT':
        return this.#conditions.nextTime()
      case 'KeyK':
        return this.#conditions.nextWeather()
      case 'KeyP':
        return this.#conditions.hold()
      default:
        return undefined
    }
  }

  /** Clicking somebody asks them along, or tells them to stay. */
  #click = (event: MouseEvent): void => {
    const target = this.#aimed()
    if (event.button !== 0 || document.pointerLockElement === null) return
    if (this.#talking.active || target?.kind !== 'talk') return
    this.#companions.toggle(target.id)
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
      case 'stash':
        this.#stashing.leave(target.id)
        break
      case 'drive':
        this.#driving.act()
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
