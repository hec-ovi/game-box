import { PROMPTS, type PromptName } from './prompts.generated.ts'

export type { PromptName }

/**
 * Reads one prompt file and fills its `{{name}}` holes. A hole with no value is
 * left as it is, so a missing value shows up in the prompt instead of vanishing.
 */
export function prompt(name: PromptName, values: Record<string, unknown> = {}): string {
  return PROMPTS[name].replace(/\{\{(\w+)\}\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  )
}

/** A list for a prompt to read, or a line saying there is nothing in it yet. */
export function bullets(items: readonly string[], empty: string): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : empty
}

/**
 * The tail of a list, because a prompt that grows with the city is a prompt
 * that costs more on every call than the one before it. A thousand names it
 * must not repeat is a thousand names it reads and ignores; the last few are
 * the ones a model would otherwise reach for.
 */
export function lastFew(items: readonly string[], most = 40): readonly string[] {
  return items.length > most ? items.slice(-most) : items
}
