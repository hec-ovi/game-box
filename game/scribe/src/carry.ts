/**
 * What a step or a beat names in the city, and what the player is holding once
 * it is done. A beat and the step it compiles to name the same things in the
 * same fields, so the walk that opens the way past a lock (`keys.ts`) and the
 * walk that checks it (`reach.ts`) read them the same way.
 */

/** One thing a step or a beat points at, by the field it points with. */
export interface Named {
  readonly field: string
  readonly ids: readonly string[]
}

/** As much of a step or a beat as either walk reads. */
export interface Doing {
  readonly kind: string
  readonly npcId?: string
  readonly toNpcId?: string
  readonly itemId?: string
  readonly alternates?: readonly string[] | undefined
  readonly machineId?: string
  readonly doorId?: string
}

/** What somebody hands the player: a thing, or the word a lock takes. */
export interface Given {
  readonly kind: string
  readonly itemId?: string
  readonly password?: string
}

export function namedBy(doing: Doing): readonly Named[] {
  switch (doing.kind) {
    case 'talk':
    case 'escort':
      return [{ field: 'npcId', ids: [doing.npcId!] }]
    case 'deliver':
      return [{ field: 'toNpcId', ids: [doing.toNpcId!] }]
    case 'collect':
    case 'buy':
      return [{ field: 'itemId', ids: [doing.itemId!, ...(doing.alternates ?? [])] }]
    case 'hack':
    case 'beat-game':
      return [{ field: 'machineId', ids: [doing.machineId!] }]
    case 'unlock':
      return [{ field: 'doorId', ids: [doing.doorId!] }]
    default:
      return []
  }
}

/** What the player holds afterwards: what they came in with, plus what this gave them, minus what they gave away. */
export function leaving(doing: Doing, gives: readonly Given[], into: ReadonlySet<string>): Set<string> {
  const out = new Set(into)
  if (doing.kind === 'collect' || doing.kind === 'buy') out.add(`item:${doing.itemId}`)
  if (doing.kind === 'deliver') out.delete(`item:${doing.itemId}`)
  if (doing.kind === 'unlock') out.add(`door:${doing.doorId}`)
  for (const given of gives) {
    if (given.kind === 'give-item') out.add(`item:${given.itemId}`)
    if (given.kind === 'take-item') out.delete(`item:${given.itemId}`)
    if (given.kind === 'give-password') out.add(`word:${given.password}`)
  }
  return out
}
