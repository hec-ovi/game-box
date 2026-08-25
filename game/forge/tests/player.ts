import type { PlayerState } from '@gb/play'
import type { Objective, QuestDoc, QuestLog } from '@gb/quest'
import type { World } from '@gb/world'
import { questTargets } from '../src/quests/targets.ts'
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
  readonly owned?: ReadonlySet<string>
  readonly choose?: Choose
  readonly hands?: Hands
  readonly living?: Living
}

/** How many rounds of doing everything on the board before a quest is called stuck. */
const ROUNDS = 60

/**
 * Somebody playing this town: one inventory, one quest log, one set of hands.
 *
 * `owned` is what belongs to somebody, which is how the game decides an
 * acquisition was a theft; the board does not publish that and a player does not
 * decide it.
 */
export class Player {
  #log: QuestLog
  #state: PlayerState
  #owned: ReadonlySet<string>
  #choose: Choose
  #hands: Hands
  #living: Living | undefined
  #held = new Set<string>()
  #out: ReadonlySet<string> = new Set()

  constructor(log: QuestLog, state: PlayerState, options: PlayerOptions = {}) {
    this.#log = log
    this.#state = state
    this.#owned = options.owned ?? new Set()
    this.#choose = options.choose ?? (() => 0)
    this.#hands = options.hands ?? HANDS
    this.#living = options.living
  }

  /** Does everything the board asks for, over and over, until the quest ends or stops moving. */
  play(quest: QuestDoc): Playthrough {
    const kinds = new Map(quest.steps.map((step) => [step.id, step.kind]))
    const blocked = new Map<string, Block>()
    const absent = new Set<string>()
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
        moved = tried.moved || moved
      }
      if (!moved) break
      if (this.#log.status(quest.id) !== 'active') break
    }

    const status = this.#log.status(quest.id)
    const stranded = open.filter((objective) => !blocked.has(objective.stepId) && !absent.has(objective.stepId)).map((objective) => objective.stepId)
    return {
      questId: quest.id,
      title: quest.title,
      status,
      completable: status === 'complete',
      paid: this.#state.money,
      blocked: [...blocked.values()],
      absent: [...absent],
      stranded: status === 'complete' ? [] : stranded,
    }
  }

  /**
   * Does one line on the board: either the board moves, or the player has not
   * got the verb it asks for, or the person it names is not at their post.
   */
  does(objective: Objective, questId: string): { moved: boolean; stopped?: Omit<Block, 'kind'>; away?: boolean } {
    const verb = verbFor(objective)
    if (!verb) return { moved: false }
    if (!this.#hands.can(verb)) return { moved: false, stopped: { stepId: objective.stepId, verb, why: this.#hands.missing(verb)!.why } }
    if (objective.npcId && this.#out.has(objective.npcId)) return { moved: false, away: true }
    const moved = this.#act(verb, objective, questId)
    this.#spend(COSTS[verb])
    return { moved }
  }

  /** Who is out on the street this round: the town's third, less whoever this quest is waiting on. */
  #lookOutside(open: readonly Objective[]): void {
    if (!this.#living) return
    this.#out = this.#living.street.out(this.#living.keepTargets ? questTargets(open) : new Set())
  }

  /** Time passing on the game clock, reported the way the running game reports it. */
  #spend(gameSeconds: number): void {
    this.#state.clock.advance(gameSeconds / this.#state.clock.rate)
    this.#log.handle({ kind: 'clock', seconds: this.#state.clock.totalSeconds })
  }

  /** Does one thing, and says whether the board moved because of it. */
  #act(verb: Verb, objective: Objective, questId: string): boolean {
    switch (verb) {
      case 'talk':
        return this.#report({ kind: 'talked', npcId: objective.npcId! })
      case 'talk about':
        return this.#report({ kind: 'talked', npcId: objective.npcId!, topic: objective.topic! })
      case 'walk':
        return this.#report({ kind: 'arrived', place: objective.place! })
      case 'walk with':
        return this.#report({ kind: 'companion-arrived', npcId: objective.npcId!, place: objective.place! })
      case 'take': {
        let moved = false
        for (const itemId of this.#some(objective, (id) => !this.#held.has(id))) {
          const stolen = this.#owned.has(itemId)
          this.#state.take(itemId, { stolen })
          this.#held.add(itemId)
          moved = this.#report({ kind: 'acquired', itemId, stolen }) || moved
        }
        return moved
      }
      case 'hand over': {
        let moved = false
        for (const itemId of this.#some(objective, (id) => this.#held.has(id))) {
          moved = this.#report({ kind: 'gave', itemId, npcId: objective.npcId! }) || moved
        }
        return moved
      }
      case 'put down': {
        let moved = false
        for (const itemId of this.#some(objective, (id) => this.#held.has(id))) {
          const place = objective.place as { interiorId: string }
          moved = this.#report({ kind: 'stashed', itemId, interiorId: place.interiorId, anchorId: objective.anchorId! }) || moved
        }
        return moved
      }
      case 'answer': {
        const options = objective.choice!.options
        const taken = options[this.#choose(options) % options.length]!
        return this.#report({ kind: 'chose', questId, stepId: objective.stepId, optionId: taken.key })
      }
    }
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
 * names a surface, only a delivery names a person and a thing together, only an
 * escort names a person and a place.
 *
 * A line publishing none of them is not the player's to act on: a `join` waiting
 * on its branches is finished by the branches, not by anybody's hands.
 */
export function verbFor(objective: Objective): Verb | undefined {
  if (objective.choice) return 'answer'
  if (objective.anchorId) return 'put down'
  if (objective.itemId && objective.npcId) return 'hand over'
  if (objective.itemId) return 'take'
  if (objective.npcId && objective.place) return 'walk with'
  if (objective.place) return 'walk'
  if (objective.topic) return 'talk about'
  if (objective.npcId) return 'talk'
  return undefined
}

/** Everything in a town that belongs to somebody: taking one of these is a theft. */
export const ownedItems = (world: World): ReadonlySet<string> =>
  new Set(world.items().filter((item) => item.ownerNpcId !== undefined).map((item) => item.id))
