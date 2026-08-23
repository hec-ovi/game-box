import type { Look } from '../build/look.ts'

/**
 * What a carried thing is made of.
 *
 * The furniture takes its colours from the room's language, because a desk
 * belongs to the office it stands in. A thing you pick up does not: an envelope
 * is the same envelope in a bar and in a flat, and a quest that sends you
 * across town for one wants it to look the same at both ends. So items paint
 * from matter, not from a palette, and the two languages share every buffer.
 *
 * Nothing here is a mirror. The room's probe is hung on its surfaces, not on
 * the one material every prop and every carried thing shares, so a metal at
 * full metalness indoors comes out black. Metal reads instead as a pale colour
 * at a low roughness with the metalness held under two thirds, which still
 * catches the room's own light.
 */
export const MATTER = {
  /** Writing paper, a note, the pages of a book. */
  paper: { colour: 0xd8d3c4, roughness: 0.92, metalness: 0 },
  /** Brighter stock: an envelope, a banknote. */
  bond: { colour: 0xece6d6, roughness: 0.9, metalness: 0 },
  manila: { colour: 0xc7a877, roughness: 0.9, metalness: 0 },
  kraft: { colour: 0xa87f52, roughness: 0.88, metalness: 0 },
  card: { colour: 0x8f6a45, roughness: 0.9, metalness: 0 },
  /** Print, a dark cover, a rubber grip. */
  ink: { colour: 0x191b1f, roughness: 0.6, metalness: 0 },
  slate: { colour: 0x394048, roughness: 0.55, metalness: 0.1 },
  oxblood: { colour: 0x5c2229, roughness: 0.5, metalness: 0 },
  navy: { colour: 0x22304c, roughness: 0.5, metalness: 0 },
  moss: { colour: 0x33452f, roughness: 0.55, metalness: 0 },
  timber: { colour: 0xa07e55, roughness: 0.85, metalness: 0 },
  pallet: { colour: 0x7d6142, roughness: 0.88, metalness: 0 },
  steel: { colour: 0x9aa1a8, roughness: 0.32, metalness: 0.55 },
  chrome: { colour: 0xc6ccd2, roughness: 0.16, metalness: 0.6 },
  gunmetal: { colour: 0x4a5158, roughness: 0.3, metalness: 0.5 },
  brass: { colour: 0xb8934a, roughness: 0.28, metalness: 0.55 },
  /** Dark bottle glass: read by its gloss, not by what is behind it. */
  bottleGlass: { colour: 0x1d3a2b, roughness: 0.07, metalness: 0 },
  brownGlass: { colour: 0x3d2413, roughness: 0.07, metalness: 0 },
  clearGlass: { colour: 0xa6c2cb, roughness: 0.05, metalness: 0 },
  drink: { colour: 0x8a4d14, roughness: 0.1, metalness: 0 },
  ceramic: { colour: 0xe5e1d7, roughness: 0.2, metalness: 0 },
  enamel: { colour: 0x2d4d5c, roughness: 0.18, metalness: 0 },
  white: { colour: 0xd6d8d4, roughness: 0.35, metalness: 0 },
  red: { colour: 0x9d2b23, roughness: 0.4, metalness: 0 },
  teal: { colour: 0x1f6f7a, roughness: 0.4, metalness: 0 },
  amber: { colour: 0xb87a1c, roughness: 0.4, metalness: 0 },
  canvas: { colour: 0x4b4b44, roughness: 0.95, metalness: 0 },
  duffel: { colour: 0x2d3a3f, roughness: 0.95, metalness: 0 },
  leather: { colour: 0x362619, roughness: 0.55, metalness: 0 },
  hide: { colour: 0x5b3d28, roughness: 0.6, metalness: 0 },
  stone: { colour: 0x8d887e, roughness: 0.8, metalness: 0 },
  jade: { colour: 0x2f7f6a, roughness: 0.16, metalness: 0 },
  petal: { colour: 0xd4506a, roughness: 0.7, metalness: 0 },
  stem: { colour: 0x3d6b3a, roughness: 0.8, metalness: 0 },
  /** A screen with something on it. Over 1 so the app's bloom finds it. */
  screen: { colour: 0x0a0d10, glow: 0x6fd0ff, glowStrength: 2.2, roughness: 0.12, metalness: 0 },
  readout: { colour: 0x120d09, glow: 0xffae4a, glowStrength: 1.8, roughness: 0.2, metalness: 0 },
  fire: { colour: 0x2a0f18, glow: 0xff7ba6, glowStrength: 2.6, roughness: 0.08, metalness: 0 },
  cyan: { colour: 0x08161a, glow: 0x8ff2ff, glowStrength: 2.4, roughness: 0.15, metalness: 0 },
} as const satisfies Record<string, Look>

export type Matter = keyof typeof MATTER
