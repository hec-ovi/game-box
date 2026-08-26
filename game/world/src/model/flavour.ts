/**
 * What kind of town a style word names.
 *
 * A style is one word, or a very few, and it is carried into every layer under
 * its own name: the city's style, the quest's style, the building's style. It
 * lives here because two boxes reading the same word must read it the same way:
 * `cyberpunk` built a mixed brown-brick town and painted it neon when the
 * generator matched whole words and the art matched stems.
 *
 * A word is read by its stem, so `cyber` finds `cyberpunk` and `harbour` finds
 * `harbourside`. Whichever flavour the style uses most words from wins, and a
 * tie goes to whichever comes first in `FLAVOURS`, so the same words always
 * give the same town.
 */

/** The handful of towns a style can be read as. Everything themed hangs off this. */
export const FLAVOURS = ['frontier', 'coastal', 'industrial', 'neon', 'alpine', 'agrarian', 'plain'] as const

export type Flavour = (typeof FLAVOURS)[number]

/** The stems that say which kind of town a style is describing. */
const STEMS: Record<Exclude<Flavour, 'plain'>, readonly string[]> = {
  neon: ['neon', 'cyber', 'synth', 'chrome', 'holo', 'arcolog', 'megacit', 'dystop', 'sprawl', 'downtown', 'skyline', 'corporate', 'blade', 'nightcit', 'night city', 'dense'],
  industrial: ['industr', 'factor', 'foundr', 'steel', 'smelt', 'refiner', 'mill', 'smog', 'soot', 'works', 'coal', 'rail', 'shipyard'],
  coastal: ['coast', 'harbou', 'port', 'seaside', 'fishing', 'island', 'bay', 'marina', 'wharf', 'tide', 'delta', 'river', 'dock', 'sea'],
  frontier: ['frontier', 'desert', 'western', 'wild west', 'dust', 'canyon', 'outpost', 'mining', 'mine', 'prospect', 'badland', 'gulch', 'saloon', 'prairie', 'gold'],
  alpine: ['alpine', 'mountain', 'snow', 'glacier', 'ski', 'summit', 'peak', 'tundra', 'fjord', 'pine', 'timber', 'highland', 'frozen', 'cold'],
  agrarian: ['farm', 'agrar', 'rural', 'village', 'orchard', 'harvest', 'meadow', 'vineyard', 'wheat', 'pastoral', 'grain', 'market town'],
}

/**
 * Which of the seven a style is. Anything that names none of them is `plain`,
 * the mixed town every other flavour is a tilt away from.
 */
export function flavourOf(style: string): Flavour {
  const text = style.toLowerCase()
  let best: Flavour = 'plain'
  let hits = 0
  for (const flavour of FLAVOURS) {
    if (flavour === 'plain') continue
    const score = STEMS[flavour].reduce((total, stem) => total + (text.includes(stem) ? 1 : 0), 0)
    if (score > hits) {
      hits = score
      best = flavour
    }
  }
  return best
}
