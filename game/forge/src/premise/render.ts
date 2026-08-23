import type { Premise } from './shape.ts'

/**
 * The premise as a few labelled lines, which is how it reaches a prompt.
 *
 * Labels rather than prose: whoever reads it is writing a bar or a person, and
 * wants to see the parts of the town separately. It is the same premise the
 * quest writer gets whole, rendered once here so two callers cannot render it
 * two ways.
 */
export function premiseLines(premise: Premise): string {
  const lines = [
    `Lives on: ${end(premise.livesOn)}`,
    `What happened: ${end(premise.happened)}`,
    `At stake: ${end(premise.stake)}`,
    `Sides: ${end(premise.sides.map((side) => `${side.name} want ${side.wants}`).join('; '))}`,
  ]
  if (premise.common.length) lines.push(`Everybody knows: ${end(premise.common.join('; '))}`)
  return lines.join('\n')
}

/** A line is a sentence, whether or not whoever wrote it finished it off. */
const end = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`)
