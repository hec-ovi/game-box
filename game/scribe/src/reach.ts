import type { Violation } from './asker.ts'
import type { CityLocks } from './locks.ts'
import type { QuestDraft } from './tools.ts'

type Step = QuestDraft['steps'][number]

/** The programs a `beat-game` step can be written against. */
const GAMES: ReadonlySet<string> = new Set(['snake', 'tetris'])

/** What a step names in the city, by the field it names it in. */
interface Named {
  readonly field: string
  readonly ids: readonly string[]
}

/**
 * What the harness holds a quest to, checked before the quest leaves here.
 *
 * `@gb/quest` proves a flow is playable; it does not know that a door opens
 * only with its key in hand or its code known, that a thing behind that door
 * cannot be picked up until it is open, that a screen is hacked only with its
 * code, or that a thing over a counter is bought only with the money. The
 * harness does, and a quest that breaks one of those is reported `shut` rather
 * than credited. So the draft is walked here the way the harness walks it,
 * carrying what the player is guaranteed to hold on every path into each
 * step, and each rule broken comes back as a violation the model can fix.
 *
 * Run only on a draft the flow check accepted, so every step is reachable and
 * the graph has no cycle.
 */
export function reachProblems(draft: QuestDraft, city: CityLocks): Violation[] {
  const problems: Violation[] = []
  const steps = new Map(draft.steps.map((step, index) => [step.id, { step, index }]))
  const held = new Map<string, ReadonlySet<string>>()
  let bill = 0

  for (const door of city.between(draft.giverNpcId)) {
    problems.push({ path: 'giverNpcId', message: `${draft.giverNpcId} stands behind the locked ${city.door(door)?.room} door: pick a giver the player can walk up to` })
  }

  for (const id of inFlowOrder(draft)) {
    const { step, index } = steps.get(id)!
    const path = `steps.${index}`
    const into = arriving(step, predecessorsOf(id, draft).map((from) => held.get(from) ?? new Set<string>()))

    for (const { field, ids } of namedBy(step)) {
      for (const target of ids) {
        for (const doorId of city.between(target)) {
          if (into.has(`door:${doorId}`)) continue
          const door = city.door(doorId)!
          problems.push({ path: `${path}.${field}`, message: `${target} is behind the locked ${door.room} door at ${door.placeName} (${doorId}): put an unlock step for ${doorId} earlier on this path` })
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
        problems.push({ path: `${path}.machineId`, message: `nothing opens ${step.machineId} yet: put a give-password effect with "${screen.password}" on an earlier talk step` })
      }
    }
    if (step.kind === 'beat-game') {
      const screen = city.screen(step.machineId)
      if (screen && !GAMES.has(screen.program)) {
        problems.push({ path: `${path}.machineId`, message: `${step.machineId} runs ${screen.program}, not a game: beat-game needs a screen running snake or tetris` })
      }
    }
    if (step.kind === 'buy') {
      const counter = city.counter(step.itemId)
      if (!counter) problems.push({ path: `${path}.itemId`, message: `${step.itemId} is not for sale over a counter: collect it instead` })
      else bill += counter.value * (step.count ?? 1)
    }

    held.set(id, leaving(step, into))
  }

  const funded = Math.max(0, ...(draft.requires ?? []).flatMap((rule) => (rule.kind === 'money-at-least' ? [rule.amount] : [])))
  if (bill > funded) {
    problems.push({ path: 'requires', message: `the buy steps cost ${bill} credits: add {"kind":"money-at-least","amount":${bill}} so the errand is offered to somebody who can pay` })
  }
  return problems
}

/** Whether what the player is guaranteed to hold gets them past this door. */
function opens(door: { keyItemId?: string | undefined; password?: string | undefined }, held: ReadonlySet<string>): boolean {
  return (door.keyItemId !== undefined && held.has(`item:${door.keyItemId}`)) || (door.password !== undefined && held.has(`word:${door.password}`))
}

function waysPast(door: { keyItemId?: string | undefined; keeperNpcId?: string | undefined; password?: string | undefined }): string {
  const ways: string[] = []
  if (door.keyItemId) ways.push(`a give-item effect with ${door.keyItemId} on a talk step with ${door.keeperNpcId ?? 'its keeper'}, who carries it`)
  if (door.password) ways.push(`a give-password effect with "${door.password}" on an earlier talk step`)
  return ways.join(', or ')
}

/** What the player holds arriving at a step: whatever every path in guarantees, or everything the branches of a join gathered. */
function arriving(step: Step, from: readonly ReadonlySet<string>[]): ReadonlySet<string> {
  if (from.length === 0) return new Set()
  if (step.kind === 'join') return new Set(from.flatMap((facts) => [...facts]))
  return new Set([...from[0]!].filter((fact) => from.every((facts) => facts.has(fact))))
}

/** What the player holds leaving a step: what they arrived with, plus what the step and its effects gave, minus what they gave away. */
function leaving(step: Step, into: ReadonlySet<string>): ReadonlySet<string> {
  const out = new Set(into)
  if (step.kind === 'collect' || step.kind === 'buy') out.add(`item:${step.itemId}`)
  if (step.kind === 'deliver') out.delete(`item:${step.itemId}`)
  if (step.kind === 'unlock') out.add(`door:${step.doorId}`)
  for (const effect of step.effects ?? []) {
    if (effect.kind === 'give-item') out.add(`item:${effect.itemId}`)
    if (effect.kind === 'take-item') out.delete(`item:${effect.itemId}`)
    if (effect.kind === 'give-password') out.add(`word:${effect.password}`)
  }
  return out
}

function namedBy(step: Step): readonly Named[] {
  switch (step.kind) {
    case 'talk':
    case 'escort':
      return [{ field: 'npcId', ids: [step.npcId] }]
    case 'deliver':
      return [{ field: 'toNpcId', ids: [step.toNpcId] }]
    case 'collect':
    case 'buy':
      return [{ field: 'itemId', ids: [step.itemId, ...(step.alternates ?? [])] }]
    case 'hack':
    case 'beat-game':
      return [{ field: 'machineId', ids: [step.machineId] }]
    case 'unlock':
      return [{ field: 'doorId', ids: [step.doorId] }]
    default:
      return []
  }
}

function successorsOf(step: Step): readonly string[] {
  return step.kind === 'choice' ? step.options.map((option) => option.next) : (step.next ?? [])
}

function predecessorsOf(id: string, draft: QuestDraft): readonly string[] {
  return draft.steps.filter((step) => successorsOf(step).includes(id)).map((step) => step.id)
}

/** Every step reachable from the start, each after all the steps that lead into it. */
function inFlowOrder(draft: QuestDraft): readonly string[] {
  const steps = new Map(draft.steps.map((step) => [step.id, step]))
  const pending = new Map<string, number>()
  const reach = (id: string): void => {
    if (pending.has(id)) return
    pending.set(id, 0)
    for (const next of successorsOf(steps.get(id)!)) {
      reach(next)
      pending.set(next, pending.get(next)! + 1)
    }
  }
  reach(draft.startStepId)

  const order: string[] = []
  const ready = [draft.startStepId]
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
