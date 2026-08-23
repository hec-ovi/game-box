import { isOptional, type QuestDoc, type Step } from './schema.ts'

/** Where a step sends the player next. A choice routes through its options. */
export function outEdges(step: Step): readonly string[] {
  return step.kind === 'choice' ? step.options.map((o) => o.next) : step.next
}

/**
 * What is wrong with where this step sends the player, if anything: a step in
 * the middle of a flow has to lead somewhere, a choice leads through its
 * options rather than `next`, a step that ends the quest leads nowhere, and
 * side work is allowed to trail off. The flow check and the draft contract both
 * ask this one question, so an author writing a quest is refused at the door
 * for exactly what would have refused the finished quest later.
 */
export function nextProblem(step: Step): string | undefined {
  if (step.kind === 'choice') return step.next.length ? 'a choice routes through its options, not next' : undefined
  if (step.kind === 'complete' || step.kind === 'fail') {
    return step.next.length ? `a ${step.kind} step ends the quest and cannot have next` : undefined
  }
  if (outEdges(step).length === 0 && !isOptional(step)) return 'dead end: no next step and not a complete/fail step'
  return undefined
}

/**
 * The static shape of one quest: which step is which, who follows whom, who
 * comes before whom. Built from a quest document that may not be sound yet, so
 * edges pointing at nothing are simply absent rather than a throw.
 */
export class Flow {
  readonly steps: ReadonlyMap<string, Step>
  readonly successors: ReadonlyMap<string, readonly string[]>
  readonly predecessors: ReadonlyMap<string, readonly string[]>

  constructor(quest: QuestDoc) {
    const steps = new Map<string, Step>()
    for (const step of quest.steps) if (!steps.has(step.id)) steps.set(step.id, step)

    const successors = new Map<string, readonly string[]>()
    const predecessors = new Map<string, string[]>()
    for (const id of steps.keys()) predecessors.set(id, [])
    for (const step of quest.steps) {
      const out = outEdges(step).filter((target) => steps.has(target))
      successors.set(step.id, out)
      for (const target of out) predecessors.get(target)?.push(step.id)
    }

    this.steps = steps
    this.successors = successors
    this.predecessors = predecessors
  }

  step(id: string): Step | undefined {
    return this.steps.get(id)
  }

  /** Steps reachable from `from`. `skipOptional` refuses to walk into optional side work. */
  reachable(from: string, skipOptional = false): Set<string> {
    const seen = new Set<string>()
    const stack = [from]
    while (stack.length) {
      const current = stack.pop()!
      if (seen.has(current)) continue
      const step = this.steps.get(current)
      if (!step) continue
      if (skipOptional && isOptional(step) && current !== from) continue
      seen.add(current)
      for (const next of this.successors.get(current) ?? []) stack.push(next)
    }
    return seen
  }

  /** Every step that can lead to this one. */
  ancestorsOf(id: string): Set<string> {
    const seen = new Set<string>()
    const stack = [...(this.predecessors.get(id) ?? [])]
    while (stack.length) {
      const current = stack.pop()!
      if (seen.has(current)) continue
      seen.add(current)
      for (const before of this.predecessors.get(current) ?? []) stack.push(before)
    }
    return seen
  }

  /** Kahn's algorithm over a subset of the steps. Undefined when they contain a cycle. */
  order(within: ReadonlySet<string>): string[] | undefined {
    const nodes = [...within]
    const nextOf = (id: string) => (this.successors.get(id) ?? []).filter((n) => within.has(n))
    const indegree = new Map<string, number>(nodes.map((id) => [id, 0]))
    for (const id of nodes) for (const next of nextOf(id)) indegree.set(next, (indegree.get(next) ?? 0) + 1)

    const queue = nodes.filter((id) => indegree.get(id) === 0)
    const order: string[] = []
    while (queue.length) {
      const id = queue.shift()!
      order.push(id)
      for (const next of nextOf(id)) {
        const left = (indegree.get(next) ?? 0) - 1
        indegree.set(next, left)
        if (left === 0) queue.push(next)
      }
    }
    return order.length === nodes.length ? order : undefined
  }
}
