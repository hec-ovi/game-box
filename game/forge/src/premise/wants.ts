import type { Premise } from '@gb/world'

/** Words in a town's story that mean people dance somewhere in it. */
const DANCING = /\b(danc\w*|nightclub\w*|disco\w*|clubs?)\b/i

/**
 * What a town's own story asks of its rooms. A town written around its clubs
 * gets a floor to dance on in its bar; one written around a harbour does not,
 * however the dice fall, because a dance floor nobody's story mentions reads as
 * a rule rather than as a place.
 */
export function callsForDancing(theme: string, premise: Premise | undefined): boolean {
  const said = [theme, premise?.livesOn, premise?.happened, premise?.stake, ...(premise?.sides.map((side) => side.wants) ?? [])]
  return said.some((line) => line !== undefined && DANCING.test(line))
}
