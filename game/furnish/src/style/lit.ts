import type { Look } from '../build/look.ts'

/**
 * The lit inks: what a machine prints on its glass and what a dance floor's
 * tiles shine in. The same in both languages, because what is on a screen
 * does not change with the room it stands in, and a dance floor is lit from
 * inside.
 *
 * Every one is dark to the touch and bright in emission, over 1 so the app's
 * bloom finds it and under a strip's 3.2 so it reads as a picture rather than
 * a lamp.
 */
function lit(glow: number, glowStrength: number): Look {
  return { colour: 0x0a0d10, glow, glowStrength, roughness: 0.3, metalness: 0 }
}

export const LIT = {
  /** A line of text. */
  paper: lit(0xf2f7ff, 1.2),
  /** A line that is there without being read: a stripe, a folder, a rule. */
  faint: lit(0x9fb4c4, 0.7),
  /** A figure in a ledger, a lock. */
  amber: lit(0xffb03a, 1.4),
  /** A schematic's walls, a snake. */
  green: lit(0x4cf0a0, 1.4),
  /** What stands in a schematic's room. */
  moss: lit(0x2c8a5c, 0.9),
  /** An unread mark, a recording dot, the food a snake is after. */
  red: lit(0xff3b3b, 1.6),
  pink: lit(0xff3d8b, 1.3),
  cyan: lit(0x28e0ff, 1.3),
  yellow: lit(0xffc21a, 1.3),
  violet: lit(0x8b5cff, 1.3),
} as const

/** The four a dance floor and a falling piece are coloured in. */
export const LIT_TILES: readonly Look[] = [LIT.pink, LIT.cyan, LIT.yellow, LIT.violet]

/**
 * The one red light in the catalog: the diode on a camera and the lamp on a
 * shut lock. Brighter than a print, so it is seen across a room.
 */
export const RED_LAMP: Look = { colour: 0x2a0606, glow: 0xff2a2a, glowStrength: 2.4, roughness: 0.3, metalness: 0 }
