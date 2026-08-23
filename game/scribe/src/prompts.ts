import { PROMPTS, type PromptName } from './prompts.generated.ts'

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
