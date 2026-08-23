import { contract } from '@gb/kit'
import type { z } from 'zod'
import { nextProblem } from './graph.ts'
import { QuestSchema, type QuestDoc } from './schema.ts'

/**
 * What an author writes: a quest without the envelope. Generators are handed
 * this so they never have to restate the format or the version, and `sealQuest`
 * puts the envelope back on.
 *
 * The door is stricter than the envelope schema in one place. A step that goes
 * nowhere is refused here, because a draft that passes and dies later in the
 * flow check is a draft the author never hears about: the boundary that can
 * hand the violation back and ask again is this one.
 */
export const QuestDraftSchema = QuestSchema.omit({ format: true, schemaVersion: true }).check((ctx) => {
  ctx.value.steps.forEach((step, index) => {
    const problem = nextProblem(step)
    if (problem) ctx.issues.push({ code: 'custom', input: step, path: ['steps', index, 'next'], message: problem })
  })
})

export const questDraftContract = contract('quest-draft', QuestDraftSchema)

export function sealQuest(draft: QuestDraft): QuestDoc {
  return { format: 'game-box.quest', schemaVersion: 1, ...draft }
}

export type QuestDraft = z.infer<typeof QuestDraftSchema>
