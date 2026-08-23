import { err, ok, type Result, type SchemaViolation } from '@gb/kit'
import { GameClock } from './clock.ts'
import { playerContract, type PlayerStateDoc } from './schema.ts'

export type PlayError =
  | { readonly code: 'invalid-save'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'wrong-world'; readonly message: string }
  | { readonly code: 'missing-item'; readonly itemId: string }
  | { readonly code: 'not-enough-money'; readonly needed: number; readonly held: number }

export const DEFAULT_FACTION = 'town'

/**
 * Everything about the playthrough that changes while it is played: what the
 * player carries, what they owe, what they have been told, who walks with them,
 * and what time it is. The world file stays untouched; this is the part that is
 * saved per playthrough.
 */
export class PlayerState {
  #doc: PlayerStateDoc
  #clock: GameClock

  private constructor(doc: PlayerStateDoc) {
    const { clock, ...rest } = doc
    this.#doc = rest
    this.#clock = GameClock.from(clock)
  }

  static create(worldId: string, startingMoney = 0): PlayerState {
    return new PlayerState({
      format: 'game-box.player',
      schemaVersion: 1,
      worldId,
      money: startingMoney,
      inventory: [],
      stolen: [],
      flags: {},
      reputation: {},
      companions: [],
    })
  }

  /** Load a save. It must belong to the world being played. */
  static load(value: unknown, worldId: string): Result<PlayerState, PlayError> {
    const parsed = playerContract.parse(value)
    if (!parsed.ok) return err({ code: 'invalid-save', violations: parsed.error })
    if (parsed.value.worldId !== worldId) {
      return err({ code: 'wrong-world', message: `save belongs to ${parsed.value.worldId}, not ${worldId}` })
    }
    return ok(new PlayerState(parsed.value))
  }

  get worldId(): string {
    return this.#doc.worldId
  }

  /** What time it is, which day it is, and the weather. Saved and restored with the rest. */
  get clock(): GameClock {
    return this.#clock
  }

  get money(): number {
    return this.#doc.money
  }

  has(itemId: string): boolean {
    return this.#doc.inventory.includes(itemId)
  }

  isStolen(itemId: string): boolean {
    return this.#doc.stolen.includes(itemId)
  }

  inventory(): readonly string[] {
    return this.#doc.inventory
  }

  companions(): readonly string[] {
    return this.#doc.companions
  }

  isCompanion(npcId: string): boolean {
    return this.#doc.companions.includes(npcId)
  }

  flag(name: string): boolean {
    return this.#doc.flags[name] ?? false
  }

  reputation(faction = DEFAULT_FACTION): number {
    return this.#doc.reputation[faction] ?? 0
  }

  take(itemId: string, options: { stolen?: boolean } = {}): void {
    if (!this.has(itemId)) this.#doc.inventory.push(itemId)
    if (options.stolen && !this.isStolen(itemId)) this.#doc.stolen.push(itemId)
  }

  drop(itemId: string): Result<void, PlayError> {
    const index = this.#doc.inventory.indexOf(itemId)
    if (index < 0) return err({ code: 'missing-item', itemId })
    this.#doc.inventory.splice(index, 1)
    const stolenIndex = this.#doc.stolen.indexOf(itemId)
    if (stolenIndex >= 0) this.#doc.stolen.splice(stolenIndex, 1)
    return ok(undefined)
  }

  earn(amount: number): void {
    this.#doc.money += Math.max(0, Math.trunc(amount))
  }

  spend(amount: number): Result<void, PlayError> {
    const needed = Math.max(0, Math.trunc(amount))
    if (this.#doc.money < needed) return err({ code: 'not-enough-money', needed, held: this.#doc.money })
    this.#doc.money -= needed
    return ok(undefined)
  }

  setFlag(name: string, value: boolean): void {
    this.#doc.flags[name] = value
  }

  adjustReputation(delta: number, faction = DEFAULT_FACTION): void {
    const next = this.reputation(faction) + Math.trunc(delta)
    this.#doc.reputation[faction] = Math.max(-100, Math.min(100, next))
  }

  addCompanion(npcId: string): void {
    if (!this.isCompanion(npcId)) this.#doc.companions.push(npcId)
  }

  removeCompanion(npcId: string): void {
    const index = this.#doc.companions.indexOf(npcId)
    if (index >= 0) this.#doc.companions.splice(index, 1)
  }

  toJSON(): PlayerStateDoc {
    return { ...this.#doc, clock: this.#clock.toJSON() }
  }
}
