import type { PlayerState } from '@gb/play'
import type { Objective, QuestDoc, QuestLog } from '@gb/quest'
import { questTargets } from '../src/quests/targets.ts'
import type { City, Target } from './city.ts'
import type { Street } from './street.ts'
import { COSTS, HANDS, type Hands, type Verb } from './verbs.ts'

/**
 * A quest played the way a player plays one.
 *
 * The board (`log.objectives()`) is the only thing it reads: the same lines the
 * interface draws, with the same fields on them. What to do is worked out from
 * what the line publishes, never from the quest document, because a player never
 * sees the document. Then it does that thing with one of the verbs the game
 * actually has (`verbs.ts`); a step that needs a verb nobody has yet stops the
 * quest and is reported, never credited. Every verb costs game seconds and the
 * clock is reported after each one, so a timer too short for its own job fails
 * here the way it would fail a player.
 *
 * The city's locks are kept: a line pointing behind a locked door is a line the
 * player cannot act on until they have opened it, with the key in hand or the
 * code known, and a door they cannot open is reported as shut rather than
 * walked through. A thing on a counter with a price is bought when the player
 * can pay and taken when they cannot, which is what the counter reports.
 *
 * The town can be alive while it is played: given a `street`, a third of the
 * people are out walking, and a line pointing at somebody who is out is a line
 * pointing at an empty room. With `keepTargets` the people a quest is waiting on
 * stay at their posts, which is the rule the running game is asked to keep.
 */

/** Which road a player takes when a quest makes them choose. */
export type Choose = (options: ReadonlyArray<{ key: string }>) => number

/** A step a player cannot get past today, and why. */
export interface Block {
  readonly stepId: string
  /** The step kind, read off the document. It names the blocker in a report; nothing is credited from it. */
  readonly kind: string
  readonly verb: Verb
  readonly why: string
}

/** How one quest went. */
export interface Playthrough {
  readonly questId: string
  readonly title: string
  /** Where the quest stands: complete, active, and whatever else the log reports. */
  readonly status: string | undefined
  /** True when a player could take this quest today and see it through. */
  readonly completable: boolean
  /** What the player was left with: a finished quest pays. */
  readonly paid: number
  /** Steps waiting on a verb nobody has yet. */
  readonly blocked: readonly Block[]
  /** Steps that point at somebody who was out walking when the player got there. */
  readonly absent: readonly string[]
  /** Steps behind a locked door the player had no way past. */
  readonly shut: readonly string[]
  /**
   * Steps that stopped for some other reason: the board asked for something it
   * published no target for, or asking for it moved nothing. Nobody else's fault
   * but this box's.
   */
  readonly stranded: readonly string[]
}

/** How the town is living while the quest is played. */
export interface Living {
  readonly street: Street
  /** Whether the people a quest is waiting on stay at their posts. */
  readonly keepTargets: boolean
}

export interface PlayerOptions {
  readonly choose?: Choose
  readonly hands?: Hands
  readonly living?: Living
}

/** How many rounds of doing everything on the board before a quest is called stuck. */
const ROUNDS = 60

/**
 * Somebody playing this town: one inventory, one quest log, one set of hands,
 * and the doors they have got open so far.
 */
export class Player {
  #log: QuestLog
  #state: PlayerState
  #city: City
  #choose: Choose
  #hands: Hands
  #living: Living | undefined
  #opened = new Set<string>()
  #out: ReadonlySet<string> = new Set()

  constructor(log: QuestLog, state: PlayerState, city: City, options: PlayerOptions = {}) {
    this.#log = log
    this.#state = state
    this.#city = city
    this.#choose = options.choose ?? (() => 0)
    this.#hands = options.hands ?? HANDS
    this.#living = options.living
  }

  /** Does everything the board asks for, over and over, until the quest ends or stops moving. */
  play(quest: QuestDoc): Playthrough {
    const kinds = new Map(quest.steps.map((step) => [step.id, step.kind]))
    const blocked = new Map<string, Block>()
    const absent = new Set<string>()
    const shut = new Set<string>()
    let open: Objective[] = []

    for (let round = 0; round < ROUNDS; round++) {
      open = this.#log.objectives().filter((objective) => objective.questId === quest.id)
      if (!open.length) break
      this.#lookOutside(open)
      let moved = false
      for (const objective of open) {
        const tried = this.does(objective, quest.id)
        if (tried.stopped) blocked.set(objective.stepId, { ...tried.stopped, kind: kinds.get(objective.stepId) ?? '?' })
        if (tried.away) absent.add(objective.stepId)
        if (tried.shut) shut.add(objective.stepId)
        moved = tried.moved || moved
      }
      if (!moved) break
      if (this.#log.status(quest.id) !== 'active') break
    }

    const status = this.#log.status(quest.id)
    const stopped = (objective: Objective) => blocked.has(objective.stepId) || absent.has(objective.stepId) || shut.has(objective.stepId)
    return {
      questId: quest.id,
      title: quest.title,
      status,
      completable: status === 'complete',
      paid: this.#state.money,
      blocked: [...blocked.values()],
      absent: [...absent],
      shut: [...shut],
      stranded: status === 'complete' ? [] : open.filter((objective) => !stopped(objective)).map((objective) => objective.stepId),
    }
  }

  /**
   * Does one line on the board: either the board moves, or the player has not
   * got the verb it asks for, or the person it names is not at their post, or
   * what it names is behind a door the player cannot open.
   */
  does(objective: Objective, questId: string): { moved: boolean; stopped?: Omit<Block, 'kind'>; away?: boolean; shut?: boolean } {
    const verb = verbFor(objective)
    if (!verb) return { moved: false }
    if (!this.#hands.can(verb)) return { moved: false, stopped: { stepId: objective.stepId, verb, why: this.#hands.missing(verb)!.why } }
    if (objective.npcId && this.#out.has(objective.npcId)) return { moved: false, away: true }
    const target = targetOf(objective)
    if (target && !this.#reaches(target)) return { moved: false, shut: true }
    const done = this.#act(verb, objective, questId)
    this.#spend(COSTS[verb])
    return done
  }

  /** Who is out on the street this round: the town's third, less whoever this quest is waiting on. */
  #lookOutside(open: readonly Objective[]): void {
    if (!this.#living) return
    this.#out = this.#living.street.out(this.#living.keepTargets ? questTargets(open) : new Set())
  }

  /** Whether every door between the street and this is open to the player. */
  #reaches(target: Target): boolean {
    return this.#city.wayTo(target).every((doorId) => this.#opened.has(doorId) || !this.#city.door(doorId)?.locked)
  }

  /** Whether the player has what opens this door: the key in hand, the code, or access granted. */
  #canOpen(doorId: string): boolean {
    const door = this.#city.door(doorId)
    if (!door || !door.locked) return true
    const key = door.keyItemId !== undefined && this.#state.has(door.keyItemId)
    const code = door.password !== undefined && this.#state.knows(door.password)
    const granted = this.#state.opens({ doorId }) || (door.from === 'outside' && this.#state.opens({ interiorId: door.interiorId }))
    return key || code || granted
  }

  /** Time passing on the game clock, reported the way the running game reports it. */
  #spend(gameSeconds: number): void {
    this.#state.clock.advance(gameSeconds / this.#state.clock.rate)
    this.#log.handle({ kind: 'clock', seconds: this.#state.clock.totalSeconds })
  }

  /** Does one thing, and says whether the board moved because of it. */
  #act(verb: Verb, objective: Objective, questId: string): { moved: boolean; shut?: boolean } {
    switch (verb) {
      case 'talk':
        return { moved: this.#report({ kind: 'talked', npcId: objective.npcId! }) }
      case 'talk about':
        return { moved: this.#report({ kind: 'talked', npcId: objective.npcId!, topic: objective.topic! }) }
      case 'walk':
        return { moved: this.#report({ kind: 'arrived', place: objective.place! }) }
      case 'walk with':
        return { moved: this.#report({ kind: 'companion-arrived', npcId: objective.npcId!, place: objective.place! }) }
      case 'take': {
        const wanted = this.#some(objective, (id) => !this.#state.has(id))
        const within = wanted.filter((id) => this.#reaches({ itemId: id }))
        if (wanted.length && !within.length) return { moved: false, shut: true }
        let moved = false
        for (const itemId of within) moved = this.#take(itemId) || moved
        return { moved }
      }
      case 'hand over': {
        let moved = false
        for (const itemId of this.#some(objective, (id) => this.#state.has(id))) {
          moved = this.#report({ kind: 'gave', itemId, npcId: objective.npcId! }) || moved
        }
        return { moved }
      }
      case 'put down': {
        let moved = false
        for (const itemId of this.#some(objective, (id) => this.#state.has(id))) {
          const place = objective.place as { interiorId: string }
          moved = this.#report({ kind: 'stashed', itemId, interiorId: place.interiorId, anchorId: objective.anchorId! }) || moved
        }
        return { moved }
      }
      case 'answer': {
        const options = objective.choice!.options
        const taken = options[this.#choose(options) % options.length]!
        return { moved: this.#report({ kind: 'chose', questId, stepId: objective.stepId, optionId: taken.key }) }
      }
      case 'unlock': {
        const doorId = objective.doorId!
        if (!this.#canOpen(doorId)) return { moved: false, shut: true }
        this.#opened.add(doorId)
        return { moved: this.#report({ kind: 'unlocked', doorId }) }
      }
      case 'hack': {
        const machineId = objective.machineId!
        const found = this.#city.machine(machineId)?.machine
        if (found?.locked && !(found.password !== undefined && this.#state.knows(found.password))) return { moved: false, shut: true }
        return { moved: this.#report({ kind: 'machine-unlocked', machineId }) }
      }
      case 'play': {
        const machineId = objective.machineId!
        const score = objective.score!
        const program = this.#city.machine(machineId)?.machine.program ?? 'blank'
        this.#state.recordScore(machineId, program, score)
        return { moved: this.#report({ kind: 'scored', machineId, score }) }
      }
    }
  }

  /** Picks one thing up: over the counter when it has a price and the player can pay, off the shelf otherwise. */
  #take(itemId: string): boolean {
    const price = this.#city.price(itemId)
    const owned = this.#city.owned(itemId)
    if (owned && price > 0 && this.#state.money >= price) {
      this.#state.buy(itemId, price)
      const bought = this.#report({ kind: 'bought', itemId })
      return this.#report({ kind: 'acquired', itemId, stolen: false }) || bought
    }
    const opens = this.#city.opens(itemId)
    this.#state.take(itemId, { stolen: owned, ...(opens ? { opens } : {}) })
    return this.#report({ kind: 'acquired', itemId, stolen: owned })
  }

  /** As many of the interchangeable things as the line still wants, out of the ones that qualify. */
  #some(objective: Objective, qualifies: (itemId: string) => boolean): string[] {
    const pool = [objective.itemId!, ...(objective.alternates ?? [])]
    const left = objective.count ? objective.count.needed - objective.count.done : 1
    return pool.filter(qualifies).slice(0, Math.max(1, left))
  }

  #report(event: Parameters<QuestLog['handle']>[0]): boolean {
    const result = this.#log.handle(event)
    return result.ok && result.value.length > 0
  }
}

/**
 * What one line on the board is asking the player to do, worked out from the
 * fields it publishes and nothing else. The sets are disjoint: only a stash
 * names a surface, only a lock names a door, only a screen names a machine and
 * only a game names a score with it, only a delivery names a person and a thing
 * together, only an escort names a person and a place.
 *
 * A line publishing none of them is not the player's to act on: a `join` waiting
 * on its branches is finished by the branches, not by anybody's hands.
 */
export function verbFor(objective: Objective): Verb | undefined {
  if (objective.choice) return 'answer'
  if (objective.anchorId) return 'put down'
  if (objective.doorId) return 'unlock'
  if (objective.machineId) return objective.score !== undefined ? 'play' : 'hack'
  if (objective.itemId && objective.npcId) return 'hand over'
  if (objective.itemId) return 'take'
  if (objective.npcId && objective.place) return 'walk with'
  if (objective.place) return 'walk'
  if (objective.topic) return 'talk about'
  if (objective.npcId) return 'talk'
  return undefined
}

/**
 * Where a line sends the player, for the locks between here and there. A
 * thing is looked up one at a time when it is taken; a line that names only a
 * place is the street outside it, which no lock keeps anybody from.
 */
function targetOf(objective: Objective): Target | undefined {
  if (objective.anchorId) return { interiorId: (objective.place as { interiorId: string }).interiorId, anchorId: objective.anchorId }
  if (objective.doorId) return { doorId: objective.doorId }
  if (objective.machineId) return { machineId: objective.machineId }
  if (objective.npcId) return { npcId: objective.npcId }
  return undefined
}
