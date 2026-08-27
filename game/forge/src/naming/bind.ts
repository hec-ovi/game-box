import type { Wrote } from '../raise/assemble.ts'
import type { PlannedSite } from '../raise/planned.ts'
import { instanceName, personName, PLACEHOLDERS, thingName, zoneName } from './placeholders.ts'

/**
 * How long a written line may be, by the field it is written in. These are
 * `@gb/quest`'s own caps: a line written against "Instance 7" and bound to
 * "The Ropewalk Rooms" grows, and a quest the file will not take is a quest
 * nobody can play.
 */
const CAPS: Readonly<Record<string, number>> = {
  title: 80,
  summary: 600,
  objective: 160,
  hint: 200,
  markerLabel: 40,
  prompt: 160,
  label: 120,
  topic: 80,
}

/**
 * Puts the town's written names into work that was written against its
 * placeholders.
 *
 * A quest is written before the town is named, so its lines say "Take it back
 * to Person 3 at Instance 7". Binding walks the whole draft and swaps every
 * placeholder for what that person and that place ended up being called. Ids
 * are untouched: only the words the player reads change, and a line that grows
 * past what the file takes is clipped where it is bound.
 *
 * A placeholder written in lower case (a recipe saying "the thing 5") comes
 * back in lower case, because that is the sentence it was written into.
 */
export function bindNames<T>(value: T, written: ReadonlyMap<string, string>, field?: string): T {
  if (typeof value === 'string') return clip(swap(value, written), field) as T
  if (Array.isArray(value)) return value.map((one) => bindNames(one, written, field)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, one]) => [key, bindNames(one, written, key)])) as T
  }
  return value
}

function swap(text: string, written: ReadonlyMap<string, string>): string {
  return text.replace(PLACEHOLDERS, (found) => {
    const name = written.get(capitalised(found))
    if (!name) return found
    return found === found.toLowerCase() ? name.toLowerCase() : name
  })
}

/** A placeholder as it is minted: one leading capital, whatever case the sentence put it in. */
const capitalised = (found: string): string => `${found[0]!.toUpperCase()}${found.slice(1).toLowerCase()}`

function clip(text: string, field: string | undefined): string {
  const most = field ? CAPS[field] : undefined
  return most && text.length > most ? `${text.slice(0, most - 1).trimEnd()}.` : text
}

/**
 * The book binding works from: every placeholder the town was laid out under,
 * against the name the story gave it.
 *
 * Zones and buildings are named in the naming pass; people and things are named
 * in the pass after it, so what a person or a thing ended up being called is
 * read off what was actually written into the world rather than off what was
 * asked for.
 */
export function bindings(planned: readonly PlannedSite[], zones: ReadonlyMap<string, string>, wrote: Wrote): Map<string, string> {
  const book = new Map<string, string>()
  for (const [at, name] of [...zones.values()].entries()) book.set(zoneName(at), name)
  for (const one of planned) {
    book.set(instanceName(one.index), one.standing?.name ?? one.sign)
    for (const post of one.inside?.posts ?? []) {
      const name = wrote.people.get(post.npcId)
      if (name) book.set(personName(post.index), name)
    }
    for (const thing of one.inside?.things ?? []) {
      const name = wrote.things.get(thing.itemId)
      if (name) book.set(thingName(thing.index), name)
    }
  }
  return book
}
