import type { QuestDoc, Step } from '@gb/quest'
import { sentence } from './text.ts'

/** Step kinds that ask the player for something they have to go and do. */
const ASKS = new Set<Step['kind']>(['talk', 'goto', 'collect', 'deliver', 'stash', 'escort'])

/**
 * What a job comes down to, in the words the quest was written with. A
 * generated quest usually opens by asking the player to hear the giver out,
 * which is settled the moment the job changes hands, so the giver says the
 * first thing that is still left to do instead.
 */
export function firstAsk(quest: QuestDoc): string {
  const seen = new Set<string>()
  let step = stepOf(quest, quest.startStepId)
  while (step && !seen.has(step.id)) {
    seen.add(step.id)
    if (!alreadyHere(step, quest.giverNpcId)) break
    step = stepOf(quest, step.next[0])
  }
  return step && ASKS.has(step.kind) ? sentence(step.objective) : ''
}

/** Hearing out the person you are already stood in front of asks for nothing. */
function alreadyHere(step: Step, giverNpcId: string): boolean {
  return step.kind === 'talk' && step.npcId === giverNpcId
}

function stepOf(quest: QuestDoc, stepId: string | undefined): Step | undefined {
  return stepId ? quest.steps.find((step) => step.id === stepId) : undefined
}
