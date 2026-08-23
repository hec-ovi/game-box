/** What the player asked for: enough to build a city, and short enough to type. */
export interface CityBrief {
  readonly theme: string
  readonly seed: string
  readonly blocks: number
  /** Write the names, people and quests with the local model rather than offline. */
  readonly model: boolean
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

/** As long as `@gb/world` will hold, so a long theme is cut rather than refused. */
const THEME_LIMIT = 60
const SEED_LIMIT = 120

export function clampBlocks(value: number): number {
  if (!Number.isFinite(value)) return DEFAULTS.blocks
  return Math.min(BLOCKS.max, Math.max(BLOCKS.min, Math.round(value)))
}

/** A brief the generator will accept, whoever typed it. */
export function tidy(brief: CityBrief): CityBrief {
  return {
    theme: (brief.theme.trim() || DEFAULTS.theme).slice(0, THEME_LIMIT),
    seed: (brief.seed.trim() || DEFAULTS.seed).slice(0, SEED_LIMIT),
    blocks: clampBlocks(brief.blocks),
    model: brief.model,
  }
}

/** The four the brief owns. Everything else in the address bar belongs to somebody else. */
const BRIEF_KEYS = ['theme', 'seed', 'blocks', 'model']

/**
 * The address bar, which is how a city is shared and how the same one is opened
 * again. Nothing in it means nothing was asked for.
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
 * The same brief written back, so the address bar names the city on screen.
 * Whatever else was asked for rides along: `?sidecar=` and `?bundle=` are not
 * the brief's to answer for, and a refresh that dropped them would quietly
 * reconnect somewhere else.
 */
export function briefToQuery(brief: CityBrief, carry?: URLSearchParams): string {
  const query = new URLSearchParams({ theme: brief.theme, seed: brief.seed, blocks: String(brief.blocks) })
  if (brief.model) query.set('model', '1')
  for (const [key, value] of carry ?? []) if (!BRIEF_KEYS.includes(key)) query.append(key, value)
  return `?${query.toString()}`
}

/** A seed nobody has played: four short words of hex. */
export function freshSeed(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
