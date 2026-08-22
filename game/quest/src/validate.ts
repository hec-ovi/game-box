import { err, ok, type Result, type SchemaViolation } from '@gb/kit'
import { questContract, type QuestDoc, type Step } from './schema.ts'
import type { WorldView } from './world-view.ts'

export interface QuestProblem {
  readonly where: string
  readonly message: string
}

export type QuestError =
  | { readonly code: 'invalid-quest'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'broken-flow'; readonly problems: readonly QuestProblem[] }

/**
 * Accept a quest only if it can actually be played: every step reachable, every
 * path ending, every person and thing it names present in the world, and every
 * item in hand by the time the player is asked to hand it over.
 */
export function validateQuest(value: unknown, world: WorldView): Result<QuestDoc, QuestError> {
  const parsed = questContract.parse(value)
  if (!parsed.ok) return err({ code: 'invalid-quest', violations: parsed.error })

  const problems = checkFlow(parsed.value, world)
  if (problems.length) return err({ code: 'broken-flow', problems })
  return ok(parsed.value)
}

export function checkFlow(quest: QuestDoc, world: WorldView): QuestProblem[] {
  const problems: QuestProblem[] = []
  const fail = (where: string, message: string) => problems.push({ where, message })

  const steps = new Map<string, Step>()
  for (const step of quest.steps) {
    if (steps.has(step.id)) fail(step.id, 'duplicate step id')
    steps.set(step.id, step)
  }

  if (!world.hasNpc(quest.giverNpcId)) fail(quest.id, `giver ${quest.giverNpcId} is not in the world`)
  for (const itemId of quest.reward.items) {
    if (!world.hasItem(itemId)) fail(quest.id, `reward item ${itemId} is not in the world`)
  }
  if (!steps.has(quest.startStepId)) {
    fail(quest.id, `startStepId ${quest.startStepId} is not one of the steps`)
    return problems
  }

  // edges
  const successors = new Map<string, string[]>()
  for (const step of quest.steps) {
    const out = step.kind === 'choice' ? step.options.map((o) => o.next) : [...step.next]
    if (step.kind === 'choice' && step.next.length) fail(step.id, 'a choice routes through its options, not next')
    if ((step.kind === 'complete' || step.kind === 'fail') && step.next.length) {
      fail(step.id, `a ${step.kind} step ends the quest and cannot have next`)
    }
    if (step.kind !== 'complete' && step.kind !== 'fail' && out.length === 0) {
      fail(step.id, 'dead end: no next step and not a complete/fail step')
    }
    for (const target of out) {
      if (!steps.has(target)) fail(step.id, `points at unknown step ${target}`)
    }
    if (step.kind === 'join') {
      for (const waited of step.waitFor) {
        const branch = steps.get(waited)
        if (!branch) fail(step.id, `waits for unknown step ${waited}`)
        else if (!(branch.kind === 'choice' ? branch.options.map((o) => o.next) : branch.next).includes(step.id)) {
          fail(step.id, `waits for ${waited}, but ${waited} does not lead to it`)
        }
      }
    }
    successors.set(step.id, out.filter((target) => steps.has(target)))
    checkReferences(step, world, fail)
  }
  if (problems.length) return problems

  // reachability
  const reachable = new Set<string>()
  const stack = [quest.startStepId]
  while (stack.length) {
    const current = stack.pop()!
    if (reachable.has(current)) continue
    reachable.add(current)
    for (const next of successors.get(current) ?? []) stack.push(next)
  }
  for (const step of quest.steps) {
    if (!reachable.has(step.id)) fail(step.id, 'unreachable from the first step')
  }
  if (![...reachable].some((id) => steps.get(id)?.kind === 'complete')) {
    fail(quest.id, 'no path reaches a complete step')
  }

  // ordering: a quest flow runs forward only
  const order = topological([...reachable], (id) => (successors.get(id) ?? []).filter((n) => reachable.has(n)))
  if (!order) {
    fail(quest.id, 'the flow loops back on itself')
    return problems
  }

  checkSolvability(quest, steps, order, successors, reachable, fail)
  return problems
}

function checkReferences(step: Step, world: WorldView, fail: (where: string, message: string) => void): void {
  const place = 'place' in step ? step.place : undefined
  if (place && 'plotId' in place && !world.hasPlot(place.plotId)) fail(step.id, `plot ${place.plotId} is not in the world`)
  if (place && 'interiorId' in place && !world.hasInterior(place.interiorId)) {
    fail(step.id, `interior ${place.interiorId} is not in the world`)
  }
  if ('npcId' in step && !world.hasNpc(step.npcId)) fail(step.id, `npc ${step.npcId} is not in the world`)
  if ('toNpcId' in step && !world.hasNpc(step.toNpcId)) fail(step.id, `npc ${step.toNpcId} is not in the world`)
  if ('itemId' in step && !world.hasItem(step.itemId)) fail(step.id, `item ${step.itemId} is not in the world`)
  if (step.kind === 'stash') {
    if (!world.hasInterior(step.interiorId)) fail(step.id, `interior ${step.interiorId} is not in the world`)
    else if (!world.hasAnchor(step.interiorId, step.anchorId)) {
      fail(step.id, `anchor ${step.anchorId} is not in interior ${step.interiorId}`)
    }
  }
  for (const effect of step.effects) {
    if ('itemId' in effect && !world.hasItem(effect.itemId)) fail(step.id, `effect names unknown item ${effect.itemId}`)
    if ('npcId' in effect && !world.hasNpc(effect.npcId)) fail(step.id, `effect names unknown npc ${effect.npcId}`)
  }
  for (const condition of step.requires) {
    if ('itemId' in condition && !world.hasItem(condition.itemId)) fail(step.id, `requires unknown item ${condition.itemId}`)
    if ('npcId' in condition && !world.hasNpc(condition.npcId)) fail(step.id, `requires unknown npc ${condition.npcId}`)
  }
}

interface Held {
  items: Set<string>
  companions: Set<string>
}

/**
 * Walks the flow forward working out what the player is guaranteed to be
 * holding when each step opens: everything gained on every path that reaches
 * it. A quest that asks for something the player cannot have yet is rejected.
 */
function checkSolvability(
  quest: QuestDoc,
  steps: Map<string, Step>,
  order: readonly string[],
  successors: Map<string, string[]>,
  reachable: Set<string>,
  fail: (where: string, message: string) => void,
): void {
  const predecessors = new Map<string, string[]>()
  for (const id of reachable) predecessors.set(id, [])
  for (const id of reachable) {
    for (const next of successors.get(id) ?? []) predecessors.get(next)?.push(id)
  }

  const after = new Map<string, Held>()
  for (const id of order) {
    const step = steps.get(id)!
    const before = entryState(step, predecessors.get(id) ?? [], after, id === quest.startStepId)

    if (step.kind === 'deliver' || step.kind === 'stash') {
      if (!before.items.has(step.itemId)) {
        fail(step.id, `asks for ${step.itemId} before the player is guaranteed to have it`)
      }
    }
    if (step.kind === 'escort' && !before.companions.has(step.npcId)) {
      fail(step.id, `escorts ${step.npcId}, who has not joined the player on every path here`)
    }
    for (const condition of step.requires) {
      if (condition.kind === 'has-item' && !before.items.has(condition.itemId)) {
        fail(step.id, `requires ${condition.itemId}, which is not guaranteed by this point`)
      }
      if (condition.kind === 'has-companion' && !before.companions.has(condition.npcId)) {
        fail(step.id, `requires ${condition.npcId} as a companion, who has not joined by this point`)
      }
    }

    after.set(id, applyStep(step, before))
  }
}

function entryState(step: Step, predecessors: readonly string[], after: Map<string, Held>, isStart: boolean): Held {
  if (isStart || predecessors.length === 0) return { items: new Set(), companions: new Set() }

  // every branch of a join runs, so everything they gathered is in hand
  const sources = step.kind === 'join' ? step.waitFor : predecessors
  const states = sources.map((id) => after.get(id)).filter((s): s is Held => s !== undefined)
  if (states.length === 0) return { items: new Set(), companions: new Set() }
  if (step.kind === 'join') {
    return {
      items: union(states.map((s) => s.items)),
      companions: union(states.map((s) => s.companions)),
    }
  }
  // otherwise only one path was taken, so only what all of them guarantee counts
  return {
    items: intersection(states.map((s) => s.items)),
    companions: intersection(states.map((s) => s.companions)),
  }
}

function applyStep(step: Step, before: Held): Held {
  const items = new Set(before.items)
  const companions = new Set(before.companions)

  if (step.kind === 'collect') items.add(step.itemId)
  if (step.kind === 'deliver' || step.kind === 'stash') items.delete(step.itemId)
  for (const effect of step.effects) {
    if (effect.kind === 'give-item') items.add(effect.itemId)
    if (effect.kind === 'take-item') items.delete(effect.itemId)
    if (effect.kind === 'companion-join') companions.add(effect.npcId)
    if (effect.kind === 'companion-leave') companions.delete(effect.npcId)
  }
  return { items, companions }
}

function union(sets: ReadonlyArray<Set<string>>): Set<string> {
  const out = new Set<string>()
  for (const set of sets) for (const value of set) out.add(value)
  return out
}

function intersection(sets: ReadonlyArray<Set<string>>): Set<string> {
  const [first, ...rest] = sets
  if (!first) return new Set()
  const out = new Set(first)
  for (const set of rest) {
    for (const value of out) if (!set.has(value)) out.delete(value)
  }
  return out
}

/** Kahn's algorithm. Returns undefined when the graph has a cycle. */
function topological(nodes: readonly string[], successorsOf: (id: string) => readonly string[]): string[] | undefined {
  const indegree = new Map<string, number>(nodes.map((id) => [id, 0]))
  for (const id of nodes) {
    for (const next of successorsOf(id)) indegree.set(next, (indegree.get(next) ?? 0) + 1)
  }
  const queue = nodes.filter((id) => (indegree.get(id) ?? 0) === 0)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const next of successorsOf(id)) {
      const left = (indegree.get(next) ?? 0) - 1
      indegree.set(next, left)
      if (left === 0) queue.push(next)
    }
  }
  return order.length === nodes.length ? order : undefined
}
