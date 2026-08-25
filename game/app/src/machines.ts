import type { Hud, ScreenGame, ScreenView } from '@gb/hud'
import type { PlayerState } from '@gb/play'
import type { QuestLog } from '@gb/quest'
import type { Furniture, Interior, Machine, World } from '@gb/world'
import type { Buildings } from './buildings.ts'
import { programOf } from './programs.ts'
import type { Reporting } from './reporting.ts'
import type { Vec2 } from './walk.ts'

/** A screen standing in the room the player is in. */
export interface Screen {
  readonly machineId: string
  readonly label: string
  readonly at: Vec2
}

/**
 * The machines on the desks: walking up to one and sitting at it. The file says
 * what each screen runs and whether it is locked; `@gb/hud` draws the glass,
 * takes the word the player types and plays the games; the playthrough keeps
 * the best score. Nothing here draws anything and nothing here scores anything:
 * it opens the screen, answers its lock, and tells the quest log what happened.
 */
export class Machines {
  #world: World
  #player: PlayerState
  #log: QuestLog
  #hud: Hud
  #report: Reporting
  #buildings: Buildings
  /** The machines whose word has been typed this playthrough. */
  #opened = new Set<string>()
  #using: string | undefined

  constructor(input: { world: World; player: PlayerState; log: QuestLog; hud: Hud; report: Reporting; buildings: Buildings }) {
    this.#world = input.world
    this.#player = input.player
    this.#log = input.log
    this.#hud = input.hud
    this.#report = input.report
    this.#buildings = input.buildings
  }

  /** Every screen in the room the player is standing in, for the crosshair. */
  here(): readonly Screen[] {
    const place = this.#buildings.place
    if (place.kind !== 'interior') return []
    return place.interior.furniture.flatMap((piece) =>
      piece.machine ? [{ machineId: piece.machine.id, label: `Use the ${piece.prop}`, at: { x: piece.pos.x, z: piece.pos.y } }] : [],
    )
  }

  /** Sit down at one: the screen goes up, locked or running. */
  use(machineId: string): void {
    const found = this.#find(machineId)
    if (!found) return
    this.#using = machineId
    this.#hud.show({ screen: this.#view(found.interior, found.piece, found.machine) })
  }

  /**
   * A word typed at a locked screen. It is the machine's own word that opens
   * it, so a player who was never given it cannot guess their way in; a hack
   * that lands is the same lock coming off, and the quest log hears it once.
   */
  unlock(machineId: string, password: string): void {
    const found = this.#find(machineId)
    if (!found || this.#using !== machineId) return
    const right = found.machine.password !== undefined && password.trim() === found.machine.password
    if (!right) {
      this.#hud.show({ screen: { ...this.#view(found.interior, found.piece, found.machine), refused: true } })
      return
    }
    this.#opened.add(machineId)
    this.#report.report(this.#log.handle({ kind: 'machine-unlocked', machineId }))
    this.#hud.show({ screen: this.#view(found.interior, found.piece, found.machine) })
  }

  /** A game on the glass ended. The best is the playthrough's, and the quest log hears the run. */
  score(machineId: string, game: ScreenGame, score: number): void {
    const found = this.#find(machineId)
    if (!found) return
    this.#player.recordScore(machineId, game, score)
    this.#report.report(this.#log.handle({ kind: 'scored', machineId, score }))
    // the best goes back on the glass without the board being restarted
    if (this.#using === machineId) this.#hud.show({ screen: this.#view(found.interior, found.piece, found.machine) })
  }

  /** The player got up: Escape, the close button, or walking away from the room. */
  closed(): void {
    this.#using = undefined
  }

  #view(interior: Interior, piece: Furniture, machine: Machine): ScreenView {
    const locked = this.#locked(machine)
    const best = this.#player.bestScore(machine.id, machine.program)
    return {
      machineId: machine.id,
      title: this.#title(interior, piece),
      locked,
      program: programOf(this.#world, interior, machine, best),
    }
  }

  /**
   * A locked screen stays locked until its word is typed at it. A word the
   * player was given by a job is a word they have already read, so a machine
   * whose word they know opens on sight and stays open across a save.
   */
  #locked(machine: Machine): boolean {
    if (!machine.locked || this.#opened.has(machine.id)) return false
    return !(machine.password !== undefined && this.#player.knows(machine.password))
  }

  /** What is written across the top of the glass: the room it stands in and the thing it is. */
  #title(interior: Interior, piece: Furniture): string {
    const room = interior.rooms.find((each) => each.id === piece.roomId)
    return room ? `${room.name} ${piece.prop}` : piece.prop
  }

  #find(machineId: string): { interior: Interior; piece: Furniture; machine: Machine } | undefined {
    const site = this.#world.machine(machineId)
    const interior = site ? this.#world.interior(site.interiorId) : undefined
    if (!site || !interior || !site.furniture.machine) return undefined
    return { interior, piece: site.furniture, machine: site.furniture.machine }
  }
}
