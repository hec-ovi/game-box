import { outEdges, type Flow } from './graph.ts'
import type { Report } from './problem.ts'
import { countOf, isHiddenStep, isOptional, itemPool, type QuestDoc, type Step } from './schema.ts'

/**
 * Everything that can be judged from the shape of the flow alone: the edges
 * make sense, nothing dangles, and the kinds that carry extra wiring (choice,
 * join, any-of, optional, hidden) are wired the way they promise to be.
 */
export function checkEdges(quest: QuestDoc, flow: Flow, report: Report): void {
  const seen = new Set<string>()
  for (const step of quest.steps) {
    if (seen.has(step.id)) report(step.id, 'duplicate step id')
    seen.add(step.id)
  }

  for (const step of flow.steps.values()) {
    const out = outEdges(step)
    if (step.kind === 'choice' && step.next.length) report(step.id, 'a choice routes through its options, not next')
    if ((step.kind === 'complete' || step.kind === 'fail') && step.next.length) {
      report(step.id, `a ${step.kind} step ends the quest and cannot have next`)
    }
    if (step.kind !== 'complete' && step.kind !== 'fail' && out.length === 0 && !isOptional(step)) {
      report(step.id, 'dead end: no next step and not a complete/fail step')
    }
    for (const target of out) if (!flow.steps.has(target)) report(step.id, `points at unknown step ${target}`)

    checkGate(step, flow, report)
    checkCount(step, report)
    checkReveal(step, flow, report)
  }
}

/** A join waits for all its branches, an any-of takes the first one home. Both need real branches. */
function checkGate(step: Step, flow: Flow, report: Report): void {
  if (step.kind !== 'join' && step.kind !== 'any-of') return
  if (isOptional(step)) report(step.id, `an optional ${step.kind} would never resolve`)

  const branches = step.kind === 'join' ? step.waitFor : step.oneOf
  const verb = step.kind === 'join' ? 'waits for' : 'offers'
  for (const branchId of branches) {
    const branch = flow.steps.get(branchId)
    if (!branch) {
      report(step.id, `${verb} unknown step ${branchId}`)
      continue
    }
    if (!outEdges(branch).includes(step.id)) report(step.id, `${verb} ${branchId}, but ${branchId} does not lead to it`)
    if (isOptional(branch)) report(step.id, `${verb} ${branchId}, which is optional and may never be done`)
  }
}

function checkCount(step: Step, report: Report): void {
  const pool = itemPool(step)
  if (!pool.size) return
  const wanted = countOf(step)
  if (wanted > pool.size) report(step.id, `wants ${wanted} items from a pool of ${pool.size}`)
}

function checkReveal(step: Step, flow: Flow, report: Report): void {
  for (const effect of step.effects) {
    if (effect.kind !== 'reveal') continue
    const target = flow.steps.get(effect.stepId)
    if (!target) report(step.id, `reveals unknown step ${effect.stepId}`)
    else if (!target.hidden) report(step.id, `reveals ${effect.stepId}, which is not hidden`)
  }
}

/**
 * What can only be judged by walking the whole graph: every step is reached,
 * the quest can be won without doing side work, hidden steps get shown, and
 * nothing loops. Returns the order the solvability walk should follow.
 */
export function checkShape(
  quest: QuestDoc,
  flow: Flow,
  report: Report,
): { readonly reachable: ReadonlySet<string>; readonly order: readonly string[] } | undefined {
  const reachable = flow.reachable(quest.startStepId)
  for (const step of quest.steps) if (!reachable.has(step.id)) report(step.id, 'unreachable from the first step')

  const withoutSideWork = flow.reachable(quest.startStepId, true)
  if (![...withoutSideWork].some((id) => flow.step(id)?.kind === 'complete')) {
    report(quest.id, 'no path reaches a complete step')
  }
  for (const id of reachable) {
    const step = flow.step(id)!
    if (!isOptional(step) && !withoutSideWork.has(id)) report(id, 'required, but only reachable through optional steps')
    if (isHiddenStep(step)) checkRevealed(step, flow, report)
  }

  const order = flow.order(reachable)
  if (!order) {
    report(quest.id, 'the flow loops back on itself')
    return undefined
  }
  return { reachable, order }
}

/**
 * A hidden step has to be put on the board by something. When it is required,
 * that something must be a step that leads to it, so the player cannot end up
 * stuck in front of an objective they were never shown.
 */
function checkRevealed(step: Step, flow: Flow, report: Report): void {
  const ancestors = flow.ancestorsOf(step.id)
  const revealers = [...flow.steps.values()].filter(
    (other) => other.id !== step.id && other.effects.some((e) => e.kind === 'reveal' && e.stepId === step.id),
  )

  if (!revealers.length) report(step.id, 'hidden, but nothing reveals it')
  else if (!isOptional(step) && !revealers.some((revealer) => ancestors.has(revealer.id))) {
    report(step.id, 'hidden and required, but nothing that must run before it reveals it')
  }
}
