import { DENSITY_LEVELS, NEON_LEVELS, WEAR_LEVELS, type Asks } from '@gb/world'

/**
 * What the player asked for. Theme, seed and size are enough to build a city;
 * the rest is optional, and a field left blank is a choice the generator makes.
 */
export interface CityBrief {
  readonly theme: string
  readonly seed: string
  readonly blocks: number
  /** Write the names, people and quests with the local model rather than offline. */
  readonly model: boolean
  /** What the city is about, in the player's own words. Unbounded: it is theirs. */
  readonly brief?: string
  /** The main quest, the side quests, the tone, and the style choices the art can draw. */
  readonly asks?: Asks
}

/** What the panel starts on, and what a bare address builds. */
export const DEFAULTS: CityBrief = { theme: 'quiet coastal town', seed: 'town', blocks: 2, model: false }

/**
 * How much city the browser will take on. The generator will go further, up to
 * whatever fits its 1024-cell grid, but this is about what a person can cross:
 * twenty blocks is already 900 m corner to corner and an eleven minute walk.
 * Past that a city needs transport more than it needs more blocks.
 */
export const BLOCKS = { min: 1, max: 24 } as const

/**
 * The style choices, each the closed list `@gb/world` will hold. The art is one
 * catalogue, so these are what a form may offer: a period or a look outside
 * them cannot be drawn, and is not offered rather than taken and dropped.
 */
export const STYLE = { neon: NEON_LEVELS, density: DENSITY_LEVELS, wear: WEAR_LEVELS } as const

export type StyleAxis = keyof typeof STYLE

/** As long as `@gb/world` will hold, so a long theme is cut rather than refused. */
const THEME_LIMIT = 60
const SEED_LIMIT = 120

export function clampBlocks(value: number): number {
  if (!Number.isFinite(value)) return DEFAULTS.blocks
  return Math.min(BLOCKS.max, Math.max(BLOCKS.min, Math.round(value)))
}

/** A brief the generator will accept, whoever typed it. Blank is absent, never an empty string. */
export function tidy(brief: CityBrief): CityBrief {
  const text = brief.brief?.trim()
  const asks = tidyAsks(brief.asks)
  return {
    theme: (brief.theme.trim() || DEFAULTS.theme).slice(0, THEME_LIMIT),
    seed: (brief.seed.trim() || DEFAULTS.seed).slice(0, SEED_LIMIT),
    blocks: clampBlocks(brief.blocks),
    model: brief.model,
    ...(text ? { brief: text } : {}),
    ...(asks ? { asks } : {}),
  }
}

/** The asks with every blank field left out, or nothing when every field was blank. */
function tidyAsks(asks: Asks | undefined): Asks | undefined {
  if (!asks) return undefined
  const words = (value: string | undefined) => value?.trim() || undefined
  const style = Object.fromEntries(
    (Object.keys(STYLE) as StyleAxis[]).flatMap((axis) => {
      const picked = asks.style?.[axis]
      return picked && (STYLE[axis] as readonly string[]).includes(picked) ? [[axis, picked]] : []
    }),
  ) as Asks['style']
  const tidied: Asks = {
    ...(words(asks.mainQuest) ? { mainQuest: words(asks.mainQuest) } : {}),
    ...(words(asks.sideQuests) ? { sideQuests: words(asks.sideQuests) } : {}),
    ...(words(asks.tone) ? { tone: words(asks.tone) } : {}),
    ...(style && Object.keys(style).length > 0 ? { style } : {}),
  }
  return Object.keys(tidied).length > 0 ? tidied : undefined
}

/** The same city asked for twice: everything the generator reads, compared whole. */
export function sameBrief(a: CityBrief, b: CityBrief): boolean {
  return JSON.stringify(tidy(a)) === JSON.stringify(tidy(b))
}

/** The four the address bar carries. Everything else in it belongs to somebody else. */
const BRIEF_KEYS = ['theme', 'seed', 'blocks', 'model']

/**
 * The address bar, which is how a city is shared by seed and how the same one is
 * asked for again. Nothing in it means nothing was asked for.
 */
export function briefFromQuery(query: URLSearchParams): CityBrief | undefined {
  if (!BRIEF_KEYS.some((key) => query.has(key))) return undefined
  return tidy({
    theme: query.get('theme') ?? DEFAULTS.theme,
    seed: query.get('seed') ?? DEFAULTS.seed,
    blocks: Number(query.get('blocks') ?? DEFAULTS.blocks),
    model: query.has('model') && query.get('model') !== '0',
  })
}

/**
 * The address bar written to name the city on screen: the brief it was built
 * from, or nothing when it came out of a file. Whatever else was asked for
 * rides along, because `?sidecar=` is not the brief's to answer for and a
 * refresh that dropped it would quietly reconnect somewhere else. `?bundle=`
 * names a file rather than a city, so it goes when the brief does.
 */
export function briefToQuery(brief: CityBrief | undefined, carry?: URLSearchParams): string {
  const query = new URLSearchParams()
  if (brief) {
    query.set('theme', brief.theme)
    query.set('seed', brief.seed)
    query.set('blocks', String(brief.blocks))
    if (brief.model) query.set('model', '1')
  }
  for (const [key, value] of carry ?? []) if (!BRIEF_KEYS.includes(key) && key !== 'bundle') query.append(key, value)
  const written = query.toString()
  return written ? `?${written}` : location.pathname
}

/** A seed nobody has played: four short words of hex. */
export function freshSeed(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
