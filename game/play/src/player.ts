import { err, ok, type Result, type SchemaViolation } from '@gb/kit'
import type { Access } from './access.ts'
import { GameClock } from './clock.ts'
import { Codex, type Discovery } from './codex.ts'
import type { Disposition } from './disposition.ts'
import { Garage, type GarageError } from './garage.ts'
import { Keyring } from './keys.ts'
import { Memories, type MemoryError, type MemorySource } from './memory.ts'
import { Purse, type MoneyError } from './money.ts'
import { MovedItems } from './moved.ts'
import { Deeds } from './owned.ts'
import { Passwords, type PasswordSource } from './passwords.ts'
import {
  playerContract,
  type CodexDoc,
  type KeyDoc,
  type MemoryDoc,
  type PasswordDoc,
  type PlacedItemDoc,
  type PlayerStateDoc,
  type ScoreDoc,
  type SpotDoc,
  type WhereDoc,
} from './schema.ts'
import { Scores } from './scores.ts'
import { placeOf } from './where.ts'

export type PlayError =
  | { readonly code: 'invalid-save'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'wrong-world'; readonly message: string }
  | { readonly code: 'missing-item'; readonly itemId: string }
  | { readonly code: 'already-carried'; readonly itemId: string }
  | MoneyError
  | MemoryError
  | GarageError

export const DEFAULT_FACTION = 'town'

/**
 * Everything about the playthrough that changes while it is played: what the
 * player carries, what they can get past, what they owe, what they own, what
 * they have been told, who walks with them, what they drive, what they have
 * found, how well they play, what each person holds of them, and what time it
 * is. The world file stays untouched; this is the part that is saved per playthrough.
 */
export class PlayerState {
  #doc: PlayerStateDoc
  #purse: Purse
  #clock: GameClock
  #moved: MovedItems
  #codex: Codex
  #memory: Memories
  #keys: Keyring
  #passwords: Passwords
  #deeds: Deeds
  #garage: Garage
  #scores: Scores

  private constructor(doc: PlayerStateDoc) {
    const { clock, where, moved, codex, memory, keys, passwords, owned, garage, scores, ...rest } = doc
    this.#doc = rest
    this.#purse = new Purse(rest.money)
    this.#clock = GameClock.from(clock)
    this.#moved = MovedItems.from(moved)
    this.#codex = Codex.from(codex)
    this.#memory = Memories.from(memory)
    this.#keys = Keyring.from(keys, (itemId) => this.has(itemId))
    this.#passwords = Passwords.from(passwords)
    this.#deeds = Deeds.from(owned)
    this.#garage = Garage.from(garage)
    this.#scores = Scores.from(scores)
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

  /**
   * Pick a thing up. Name `opens` when it is a key or a card, with what the
   * city file says it opens: the access rides on the thing, and leaves with it.
   */
  take(itemId: string, options: { stolen?: boolean; opens?: Access } = {}): void {
    if (!this.has(itemId)) this.#doc.inventory.push(itemId)
    if (options.stolen && !this.isStolen(itemId)) this.#doc.stolen.push(itemId)
    if (options.opens) this.#keys.hold(itemId, options.opens)
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

  /** What is standing in one interior: the things put in a home, or left in any room. */
  placedIn(interiorId: string): readonly PlacedItemDoc[] {
    return this.#moved.listIn(interiorId)
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
    this.#keys.release(itemId)
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

  /** Keep a line the player was told of the city: a premise line, an announcement. */
  told(text: string): void {
    this.#codex.told(text)
  }

  /** What the player has been told of the city, oldest first, at most `HISTORY_CAP` lines. */
  history(): readonly string[] {
    return this.#codex.history()
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

  /** Access with nothing to carry: a quest reward, a door buzzed open for good. */
  grant(access: Access): void {
    this.#keys.grant(access)
  }

  /** Whether a key or card in hand, or access granted, opens that door or that interior's street door. */
  opens(access: Access): boolean {
    return this.#keys.opens(access)
  }

  /** Every key and card in hand by what it opens, and every access granted, in the order come by. */
  keys(): readonly KeyDoc[] {
    return this.#keys.list()
  }

  /** The player was given a password, by a quest or by a person. Answers whether it was new. */
  learn(password: string, from: PasswordSource): boolean {
    return this.#passwords.learn(password, from)
  }

  /** Whether the player has been given exactly that word. */
  knows(password: string): boolean {
    return this.#passwords.knows(password)
  }

  /** Every password given, oldest first, each with who gave it. */
  passwords(): readonly PasswordDoc[] {
    return this.#passwords.list()
  }

  /** The deed to a place is the player's now. */
  own(interiorId: string): void {
    this.#deeds.own(interiorId)
  }

  owns(interiorId: string): boolean {
    return this.#deeds.owns(interiorId)
  }

  /** Every place the player holds the deed to, first bought first. */
  owned(): readonly string[] {
    return this.#deeds.list()
  }

  /** A car is the player's to keep, by model. */
  keepCar(model: string): void {
    this.#garage.keep(model)
  }

  hasCar(model: string): boolean {
    return this.#garage.has(model)
  }

  /** Every car kept, first kept first. */
  cars(): readonly string[] {
    return this.#garage.list()
  }

  /** Bring a kept car out; whichever was out goes back in. Refused for a car not kept. */
  takeOutCar(model: string): Result<void, PlayError> {
    return this.#garage.takeOut(model)
  }

  /** No car out on the street. */
  putAwayCar(): void {
    this.#garage.putAway()
  }

  /** The model out on the street, if one is. */
  get carOut(): string | undefined {
    return this.#garage.out
  }

  /** A game on a machine ended on that many points. Answers whether it is a new best. */
  recordScore(machineId: string, game: string, points: number): boolean {
    return this.#scores.record(machineId, game, points)
  }

  /** The best so far at that game on that machine, if it has been played. */
  bestScore(machineId: string, game: string): number | undefined {
    return this.#scores.best(machineId, game)
  }

  /** Every best, one per game per machine, in the order first played. */
  scores(): readonly ScoreDoc[] {
    return this.#scores.list()
  }

  toJSON(): PlayerStateDoc {
    const doc: PlayerStateDoc = { ...this.#doc, money: this.#purse.balance, clock: this.#clock.toJSON() }
    if (this.#doc.where) doc.where = { ...this.#doc.where }
    if (this.#moved.any) doc.moved = this.#moved.toJSON()
    if (this.#codex.any) doc.codex = this.#codex.toJSON()
    const memory = this.#memory.toJSON()
    if (Object.keys(memory).length > 0) doc.memory = memory
    if (this.#keys.any) doc.keys = this.#keys.toJSON()
    if (this.#passwords.any) doc.passwords = this.#passwords.toJSON()
    if (this.#deeds.any) doc.owned = this.#deeds.toJSON()
    if (this.#garage.any) doc.garage = this.#garage.toJSON()
    if (this.#scores.any) doc.scores = this.#scores.toJSON()
    return doc
  }
}
