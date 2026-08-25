import type { Dressing } from '@gb/scene'

/**
 * Everything the dressing behind answers for that the wrapper in front of it
 * does not. A wrapper names what it speaks for and this carries the rest over,
 * whatever the rest turns out to be.
 *
 * The seam grows. The far look of a building, the light it throws, road paint,
 * rubbish and the bodies the cast spawned each arrived after the wrappers in
 * this box were written, and every one of them had to be added to every
 * wrapper by hand: one missed is a capability that vanishes on the way through
 * with nothing on screen to say so. `@gb/scene` and this box both read an
 * answer by asking whether it is there, so a wrapper that carries the rest by
 * itself cannot drop the next one.
 *
 * `except` names what the front speaks for even when it leaves it off, for a
 * composition that takes one answer off another dressing entirely.
 */
export function carryOver<T extends Dressing>(front: T, behind: Dressing, except: readonly string[] = []): T {
  const carrier = front as unknown as Record<string, unknown>
  for (const [name, answer] of answered(behind)) {
    if (name in carrier || except.includes(name)) continue
    carrier[name] = (...args: unknown[]) => answer.apply(behind, args)
  }
  return front
}

/**
 * Every question a dressing answers, its own and its class's: methods only, so
 * a property that computes itself when it is read is never read here.
 */
function answered(dressing: Dressing): [string, (...args: unknown[]) => unknown][] {
  const found = new Map<string, (...args: unknown[]) => unknown>()
  for (let level = dressing as object | null; level && level !== Object.prototype; level = Object.getPrototypeOf(level) as object | null) {
    for (const name of Object.getOwnPropertyNames(level)) {
      if (name === 'constructor' || found.has(name)) continue
      const answer = Object.getOwnPropertyDescriptor(level, name)?.value as unknown
      if (typeof answer === 'function') found.set(name, answer as (...args: unknown[]) => unknown)
    }
  }
  return [...found]
}
