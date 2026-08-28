import type { QuestDoc, Step } from '@gb/quest'
import type { Violation } from './asker.ts'
import { leaving, namedBy } from './carry.ts'
import type { CityLocks } from './locks.ts'

/** The programs a `beat-game` step can be written against. */
const GAMES: ReadonlySet<string> = new Set(['snake', 'tetris'])

/**
 * What the harness holds a quest to, checked before the quest leaves here.
 *
 * `@gb/quest` proves a flow is playable; it does not know that a door opens
 * only with its key in hand or its code known, that a thing behind that door
 * cannot be picked up until it is open, that a screen is hacked only with its
 * code, or that a game is only played on a screen that runs one. The harness
 * does, and a quest that breaks one of those is reported `shut` rather than
 * credited. So the compiled quest is walked here the way the harness walks it,
 * carrying what the player is guaranteed to hold on every path into each step,
 * and each rule broken comes back as a violation pointed at the beat it was
 * written from, in words the writer can act on.
 *
 * Run only on a quest `@gb/quest` accepted, so every step is reachable and the
 * graph has no cycle.
 */
export function reachProblems(quest: QuestDoc, city: CityLocks, beatOf: ReadonlyMap<string, string>): Violation[] {
  const problems: Violation[] = []
  const steps = new Map(quest.steps.map((step) => [step.id, step]))
  const held = new Map<string, ReadonlySet<string>>()

  for (const door of city.between(quest.giverNpcId)) {
    problems.push({ path: 'giverNpcId', message: `${quest.giverNpcId} stands behind the locked ${city.door(door)?.room} door: pick a giver the player can walk up to` })
  }

  for (const id of inFlowOrder(quest)) {
    const step = steps.get(id)!
    const path = beatOf.get(id) ?? id
    const into = arriving(step, predecessorsOf(id, quest).map((from) => held.get(from) ?? new Set<string>()))

    for (const { field, ids } of namedBy(step)) {
      for (const target of ids) {
        for (const doorId of city.between(target)) {
          if (into.has(`door:${doorId}`)) continue
          const door = city.door(doorId)!
          problems.push({ path: `${path}.${field}`, message: `${target} is behind the locked ${door.room} door at ${door.placeName} (${doorId}): put an unlock beat for ${doorId} earlier` })
        }
      }
    }

    if (step.kind === 'unlock') {
      const door = city.door(step.doorId)
      if (door && !opens(door, into)) problems.push({ path: `${path}.doorId`, message: `nothing opens ${step.doorId} yet: ${waysPast(door)}` })
    }
    if (step.kind === 'hack') {
      const screen = city.screen(step.machineId)
      if (screen && !screen.locked) problems.push({ path: `${path}.machineId`, message: `${step.machineId} is not locked, so there is nothing to hack` })
      if (screen?.locked && !into.has(`word:${screen.password}`)) {
        problems.push({ path: `${path}.machineId`, message: `nothing opens ${step.machineId} yet: have an earlier talk beat hand over the code "${screen.password}"` })
      }
    }
    if (step.kind === 'beat-game') {
      const screen = city.screen(step.machineId)
      if (screen && !GAMES.has(screen.program)) {
        problems.push({ path: `${path}.machineId`, message: `${step.machineId} runs ${screen.program}, not a game: beat-game needs a screen running snake or tetris` })
      }
    }
    if (step.kind === 'buy' && !city.counter(step.itemId)) {
      problems.push({ path: `${path}.itemId`, message: `${step.itemId} is not for sale over a counter: collect it instead` })
    }

    held.set(id, leaving(step, step.effects, into))
  }
  return problems
}

/** Whether what the player is guaranteed to hold gets them past this door. */
function opens(door: { keyItemId?: string | undefined; password?: string | undefined }, held: ReadonlySet<string>): boolean {
  return (door.keyItemId !== undefined && held.has(`item:${door.keyItemId}`)) || (door.password !== undefined && held.has(`word:${door.password}`))
}

function waysPast(door: { keyItemId?: string | undefined; keeperNpcId?: string | undefined; password?: string | undefined }): string {
  const ways: string[] = []
  if (door.keyItemId) ways.push(`a talk beat with ${door.keeperNpcId ?? 'its keeper'}, who carries it, handing over ${door.keyItemId}`)
  if (door.password) ways.push(`an earlier talk beat handing over the code "${door.password}"`)
  return ways.join(', or ')
}

/** What the player holds arriving at a step: whatever every path in guarantees, or everything the branches of a join gathered. */
function arriving(step: Step, from: readonly ReadonlySet<string>[]): ReadonlySet<string> {
  if (from.length === 0) return new Set()
  if (step.kind === 'join') return new Set(from.flatMap((facts) => [...facts]))
  return new Set([...from[0]!].filter((fact) => from.every((facts) => facts.has(fact))))
}

function successorsOf(step: Step): readonly string[] {
  return step.kind === 'choice' ? step.options.map((option) => option.next) : step.next
}

function predecessorsOf(id: string, quest: QuestDoc): readonly string[] {
  return quest.steps.filter((step) => successorsOf(step).includes(id)).map((step) => step.id)
}

/** Every step reachable from the start, each after all the steps that lead into it. */
function inFlowOrder(quest: QuestDoc): readonly string[] {
  const steps = new Map(quest.steps.map((step) => [step.id, step]))
  const pending = new Map<string, number>()
  const reach = (id: string): void => {
    if (pending.has(id)) return
    pending.set(id, 0)
    for (const next of successorsOf(steps.get(id)!)) {
      reach(next)
      pending.set(next, pending.get(next)! + 1)
    }
  }
  reach(quest.startStepId)

  const order: string[] = []
  const ready = [quest.startStepId]
  while (ready.length) {
    const id = ready.shift()!
    order.push(id)
    for (const next of successorsOf(steps.get(id)!)) {
      const left = pending.get(next)! - 1
      pending.set(next, left)
      if (left === 0) ready.push(next)
    }
  }
  return order
}
