import type { Charter, Frontage, Signage, SignVoice } from '@gb/world'

/**
 * What the street sees of a kind of place beyond its walls: how much sign it
 * hangs, the tint the scene grades it with, and the tags a building catalogue
 * matches a look against. All read off the charter's axes.
 */

/** How much sign each voice hangs: the blade, the hanging sign, the lit accents and the nameplate. */
const VOICES: Record<SignVoice, Signage> = {
  quiet: { blade: 0, hanging: 0, accents: 1, nameplate: 0.28 },
  sober: { blade: 0.26, hanging: 0.4, accents: 2, nameplate: 0.7 },
  trade: { blade: 0.4, hanging: 0.64, accents: 4, nameplate: 1 },
  loud: { blade: 0.72, hanging: 0.8, accents: 4, nameplate: 1 },
}

/** The tint a frontage is graded with, packed `0xRRGGBB`. */
const TINTS: Record<Frontage, number> = {
  masonry: 0x9a8a76,
  painted: 0x8c5a3c,
  shopfront: 0x7a7a9a,
  curtain: 0x8a95a0,
  industrial: 0x6a6a60,
  blank: 0x5a5a56,
}

export const signageFor = (voice: SignVoice): Signage => ({ ...VOICES[voice] })

export const tintFor = (frontage: Frontage): number => TINTS[frontage]

/** The tags a catalogue look is matched against: the word and the four axes that describe a building's mass. */
export const suitsFor = (charter: Charter): string[] =>
  [charter.word, charter.street.frontage, charter.street.material, charter.size.sprawl, charter.prominence].sort()
