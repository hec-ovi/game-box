import { err, ok, type Result, type SchemaViolation } from '@gb/kit'
import { GameClock } from './clock.ts'
import { Codex, type Discovery } from './codex.ts'
import type { Disposition } from './disposition.ts'
import { Memories, type MemoryError, type MemorySource } from './memory.ts'
import { Purse, type MoneyError } from './money.ts'
import { MovedItems } from './moved.ts'
import {
  playerContract,
  type CodexDoc,
  type MemoryDoc,
  type PlacedItemDoc,
  type PlayerStateDoc,
  type SpotDoc,
  type WhereDoc,
} from './schema.ts'
import { placeOf } from './where.ts'

export type PlayError =
  | { readonly code: 'invalid-save'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'wrong-world'; readonly message: string }
  | { readonly code: 'missing-item'; readonly itemId: string }
  | { readonly code: 'already-carried'; readonly itemId: string }
  | MoneyError
  | MemoryError

export const DEFAULT_FACTION = 'town'

/**
 * Everything about the playthrough that changes while it is played: what the
 * player carries, what they owe, what they have been told, who walks with them,
 * what they have found, what each person holds of them, and what time it is.
 * The world file stays untouched; this is the part that is saved per playthrough.
 */
export class PlayerState {
  #doc: PlayerStateDoc
  #purse: Purse
  #clock: GameClock
  #moved: MovedItems
  #codex: Codex
  #memory: Memories

  private constructor(doc: PlayerStateDoc) {
    const { clock, where, moved, codex, memory, ...rest } = doc
    this.#doc = rest
    this.#purse = new Purse(rest.money)
    this.#clock = GameClock.from(clock)
    this.#moved = MovedItems.from(moved)
    this.#codex = Codex.from(codex)
    this.#memory = Memories.from(memory)
    // a thing in hand is not also on a shelf, whatever a hand-made save says
    for (const itemId of this.#doc.inventory) this.#moved.clear(itemId)
    if (where) this.setWhere(where)
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

  /** Where the player was standing last, if anywhere: a new playthrough has nowhere yet. */
  get where(): WhereDoc | undefined {
    const place = this.#doc.where
    return place ? { ...place } : undefined
  }

  /**
   * Remember where the player is standing. Indoors, name the interior: the
   * metres are then the room's own and mean nothing out in the city. A place
   * whose numbers are not real leaves the last one standing.
   */
  setWhere(where: WhereDoc): void {
    const place = placeOf(where)
    if (place) this.#doc.where = place
  }

  /**
   * The quest the player chose to track. Just a name to this box: it can be one
   * that has since been finished, given up or never existed here, and the caller
   * that knows the quests decides what to do about that.
   */
  get tracked(): string | undefined {
    return this.#doc.tracked
  }

  /** Track a quest, or nothing to track none. */
  setTracked(questId: string | null | undefined): void {
    const id = questId?.trim()
    if (id) this.#doc.tracked = id
    else delete this.#doc.tracked
  }

  get money(): number {
    return this.#purse.balance
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
    this.#moved.clear(itemId)
  }

  /** Where that thing is standing now, if the player carried it off and left it somewhere. */
  placedAt(itemId: string): SpotDoc | undefined {
    return this.#moved.at(itemId)
  }

  /** Everything the player has left somewhere, so a room can be dressed with it again. */
  placed(): readonly PlacedItemDoc[] {
    return this.#moved.list()
  }

  /**
   * Leave a thing on a surface, or `null` to forget one that is standing
   * nowhere this city has. Leaving something is putting it down, so it goes out
   * of the inventory and loses its stolen mark, exactly as dropping it does.
   */
  place(itemId: string, at: SpotDoc | null): void {
    if (!at) {
      this.#moved.clear(itemId)
      return
    }
    // leaving it is dropping it; it is nothing to fix here if it was never in hand
    if (this.#moved.put(itemId, at)) this.drop(itemId)
  }

  drop(itemId: string): Result<void, PlayError> {
    const index = this.#doc.inventory.indexOf(itemId)
    if (index < 0) return err({ code: 'missing-item', itemId })
    this.#doc.inventory.splice(index, 1)
    const stolenIndex = this.#doc.stolen.indexOf(itemId)
    if (stolenIndex >= 0) this.#doc.stolen.splice(stolenIndex, 1)
    return ok(undefined)
  }

  /** A reward. */
  earn(amount: number): void {
    this.#purse.earn(amount)
  }

  /** Hand credits over. A refused payment deducts nothing. */
  pay(amount: number): Result<void, PlayError> {
    return this.#purse.pay(amount)
  }

  /** Pay for a thing and carry it off in one motion. Refused, nothing is paid and nothing taken. */
  buy(itemId: string, price: number): Result<void, PlayError> {
    if (this.has(itemId)) return err({ code: 'already-carried', itemId })
    const paid = this.pay(price)
    if (!paid.ok) return paid
    this.take(itemId)
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

  /** Note a place walked into or a person met, for the codex. */
  discover(found: Discovery): void {
    this.#codex.discover(found)
  }

  /** Everything found so far: places in the order entered, people in the order met, each with what was learned of them. */
  discovered(): CodexDoc {
    return this.#codex.list()
  }

  /** Learn one of a person's background facts. */
  unlock(npcId: string, factId: string): void {
    this.#codex.unlock(npcId, factId)
  }

  /** The background facts learned about one person, in the order learned. */
  unlocked(npcId: string): readonly string[] {
    return this.#codex.unlocked(npcId)
  }

  /** Give one person a fact to hold about the player. Nobody else hears it. */
  remember(npcId: string, fact: string, source: MemorySource): Result<void, PlayError> {
    return this.#memory.remember(npcId, fact, source)
  }

  /** What one person holds, oldest first. */
  memories(npcId: string): readonly MemoryDoc[] {
    return this.#memory.memories(npcId)
  }

  /** How one person feels about the player. */
  disposition(npcId: string): Disposition {
    return this.#memory.disposition(npcId)
  }

  /** One step friendlier, for that person only. */
  warm(npcId: string): void {
    this.#memory.warm(npcId)
  }

  /** One step colder, for that person only. */
  cool(npcId: string): void {
    this.#memory.cool(npcId)
  }

  toJSON(): PlayerStateDoc {
    const doc: PlayerStateDoc = { ...this.#doc, money: this.#purse.balance, clock: this.#clock.toJSON() }
    if (this.#doc.where) doc.where = { ...this.#doc.where }
    if (this.#moved.any) doc.moved = this.#moved.toJSON()
    if (this.#codex.any) doc.codex = this.#codex.toJSON()
    const memory = this.#memory.toJSON()
    if (Object.keys(memory).length > 0) doc.memory = memory
    return doc
  }
}
