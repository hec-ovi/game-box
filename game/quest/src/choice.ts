import type { Step } from './schema.ts'

/**
 * One road out of a choice: the words on the button, and the key the caller
 * sends straight back as `optionId` on a `chose` event. Where the road goes is
 * deliberately absent. That is the far side of the choice, and the player has
 * not made it yet.
 */
export interface ChoiceOption {
  readonly key: string
  readonly label: string
}

/** The decision a choice step is asking for: the question, and the roads out of it. */
export interface Choice {
  readonly prompt: string
  readonly options: readonly ChoiceOption[]
}

/** The decision a step is asking for, in the order the quest wrote it. Nothing for every other kind. */
export function choiceOf(step: Step): { choice?: Choice } {
  if (step.kind !== 'choice') return {}
  const options = step.options.map((option) => ({ key: option.id, label: option.label }))
  return { choice: { prompt: step.prompt, options } }
}
