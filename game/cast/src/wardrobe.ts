import { BODY_KINDS, type BodyKind, type Npc } from '@gb/world'
import { CastError } from './error.ts'
import { hash01 } from './hash.ts'

/** One dressed character: a body wearing an outfit, built into one file. */
export interface WardrobeEntry {
  readonly id: string
  readonly body: BodyKind
  /** Where the GLB sits in the pack, e.g. `characters/male-office.glb`. */
  readonly file: string
  /** The roles this outfit suits. */
  readonly roles: readonly string[]
  /** Words that, in a world's theme, make this outfit a better fit. */
  readonly themes: readonly string[]
  /** The hairstyle nodes this character file carries; one is shown per NPC. */
  readonly styles: readonly string[]
  /** The eyebrow nodes; one is shown per NPC. */
  readonly brows: readonly string[]
  /** The beard node, if the file carries one. */
  readonly beard?: string
}

/** Everything the pack can dress somebody in. Built by `tools/build-wardrobe.mjs`. */
export interface Wardrobe {
  readonly characters: readonly WardrobeEntry[]
}

/** Reads `wardrobe.json` from the pack, refusing anything the game cannot use. */
export function parseWardrobe(value: unknown): Wardrobe {
  const characters = (value as Wardrobe | undefined)?.characters
  if (!Array.isArray(characters) || !characters.length) {
    throw new CastError('bad-wardrobe', 'wardrobe.json', 'no characters in it')
  }
  for (const entry of characters) {
    const wrong = problemWith(entry)
    if (wrong) throw new CastError('bad-wardrobe', `wardrobe.json: ${String(entry?.id)}`, wrong)
  }
  // a character built before hairstyles existed simply has none
  return {
    characters: characters.map((entry) => ({ ...entry, styles: entry.styles ?? [], brows: entry.brows ?? [] })),
  }
}

function problemWith(entry: WardrobeEntry): string | undefined {
  if (typeof entry?.id !== 'string' || !entry.id) return 'no id'
  if (!(BODY_KINDS as readonly string[]).includes(entry.body)) return `${entry.body} is not a body kind`
  if (typeof entry.file !== 'string' || !entry.file) return 'no file'
  if (!Array.isArray(entry.roles) || !Array.isArray(entry.themes)) return 'roles and themes must be lists'
  if (entry.styles !== undefined && !Array.isArray(entry.styles)) return 'styles must be a list'
  if (entry.brows !== undefined && !Array.isArray(entry.brows)) return 'brows must be a list'
  return undefined
}

/**
 * Whose rail each body dresses from. The pack ships one build per sex, so a
 * hero body is the plain body's mesh and wears the plain body's outfits; a
 * kind added to `@gb/world` does not compile here until it is given a rail.
 */
const RAIL: Record<BodyKind, BodyKind> = {
  male: 'male',
  female: 'female',
  'hero-male': 'male',
  'hero-female': 'female',
}

/**
 * Who wears what. An outfit on this body's rail wins over one that is not, an
 * outfit made for this role wins over one that is not, and a theme word the
 * world uses breaks the tie above chance. Whatever is left is picked by the
 * NPC's id, so the same city dresses the same way every time it is opened, and
 * a room of clerks is not one clerk copied.
 */
export function chooseCharacter(wardrobe: Wardrobe, npc: Npc, theme: string): WardrobeEntry {
  const rail = RAIL[npc.appearance.base]
  const fitting = wardrobe.characters.filter((entry) => entry.body === rail)
  // nobody goes out naked: a wardrobe with nothing on this rail dresses off the whole of it
  const pool = fitting.length ? fitting : wardrobe.characters
  const words = theme.toLowerCase()

  const scored = pool.map((entry) => ({ entry, score: suits(entry, npc, words) }))
  const best = Math.max(...scored.map((option) => option.score))
  const shortlist = scored.filter((option) => option.score === best).map((option) => option.entry)
  return shortlist[Math.floor(hash01(npc.id) * shortlist.length)]!
}

function suits(entry: WardrobeEntry, npc: Npc, theme: string): number {
  const role = entry.roles.includes(npc.role) ? 2 : 0
  const place = entry.themes.some((word) => theme.includes(word.toLowerCase())) ? 1 : 0
  return role + place
}
