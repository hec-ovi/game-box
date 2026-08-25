import type { SaveDoc } from '../schema.ts'
import type { Ledger } from './ledger.ts'
import type { Resolver } from './resolver.ts'

type ProgressDoc = SaveDoc['questProgress']
type Entry = ProgressDoc['quests'][string]

/**
 * The quest progress with every quest this city has not got taken out. A quest
 * the player has touched is kept only when it is the same quest and every step
 * the record names is still in it; anything else would open a job they never took.
 */
export function reconcileProgress(doc: ProgressDoc, resolve: Resolver, ledger: Ledger): ProgressDoc {
  return {
    ...doc,
    quests: Object.fromEntries(Object.entries(doc.quests).filter(([id, entry]) => keep(id, entry, resolve, ledger))),
  }
}

function keep(id: string, entry: Entry, resolve: Resolver, ledger: Ledger): boolean {
  if (entry.status === 'unstarted') return resolve.hasQuest(id)
  const quest = resolve.quest(id)
  const steps = new Set(quest?.steps.map((step) => step.id))
  return ledger.judge('quest', id, quest !== undefined && namedSteps(entry).every((stepId) => steps.has(stepId)))
}

function namedSteps(entry: Entry): string[] {
  return [...entry.open, ...entry.done, ...entry.revealed, ...entry.abandoned, ...Object.keys(entry.credited)]
}
