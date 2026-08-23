/** The handful of towns a theme can be read as. Everything themed hangs off this. */
export const FLAVOURS = ['frontier', 'coastal', 'industrial', 'neon', 'alpine', 'agrarian', 'plain'] as const

export type Flavour = (typeof FLAVOURS)[number]

/** Words that say which kind of town a free-text theme is describing. */
const KEYWORDS: Record<Exclude<Flavour, 'plain'>, readonly string[]> = {
  frontier: ['western', 'west', 'mining', 'mine', 'desert', 'dusty', 'dust', 'frontier', 'gulch', 'saloon', 'canyon', 'prairie', 'badlands', 'outpost', 'gold'],
  coastal: ['coastal', 'coast', 'port', 'harbour', 'harbor', 'sea', 'seaside', 'fishing', 'island', 'bay', 'delta', 'river', 'dock', 'docks', 'marina', 'tide'],
  industrial: ['industrial', 'factory', 'rail', 'railway', 'steel', 'foundry', 'mill', 'smog', 'coal', 'refinery', 'works', 'shipyard', 'soot'],
  neon: ['neon', 'cyber', 'chrome', 'arcology', 'megacity', 'holo', 'synth', 'sprawl', 'downtown', 'dense', 'skyline', 'corporate'],
  alpine: ['alpine', 'mountain', 'snow', 'snowy', 'glacier', 'pine', 'ski', 'tundra', 'timber', 'highland', 'frozen', 'cold'],
  agrarian: ['farming', 'farm', 'agrarian', 'orchard', 'vineyard', 'wheat', 'pastoral', 'village', 'rural', 'harvest', 'market-town', 'grain'],
}

/**
 * Reads a free-text theme as one of the flavours. Whichever flavour the theme
 * uses the most words from wins; a theme that names none of them is `plain`,
 * which is the mixed town every other flavour is a tilt away from.
 */
export function flavourOf(theme: string): Flavour {
  const words = new Set(theme.toLowerCase().split(/[^a-z]+/).filter(Boolean))
  let best: Flavour = 'plain'
  let hits = 0
  for (const [flavour, vocabulary] of Object.entries(KEYWORDS) as Array<[Flavour, readonly string[]]>) {
    const score = vocabulary.reduce((total, word) => total + (words.has(word) ? 1 : 0), 0)
    if (score > hits) {
      hits = score
      best = flavour
    }
  }
  return best
}
