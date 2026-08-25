import type { Signage } from '@gb/world'

/** The most small lit accents a wall carries: the door lamps, a strip, a tube and a board. One more would stack a second board. */
export const MOST_ACCENTS = 4

/** A signage row this box will not hang: a chance outside 0 to 1, or more accents than the wall has things for. */
export class SignageOutOfRange extends Error {
  readonly code = 'signage-out-of-range' as const
  readonly signage: Signage

  constructor(signage: Signage) {
    super(`kitbash: signage out of range: ${JSON.stringify(signage)} (chances 0 to 1, accents 0 to ${MOST_ACCENTS})`)
    this.name = 'SignageOutOfRange'
    this.signage = signage
  }
}

/** Refuses a row the file should never carry, before a single letter is placed. */
export function checkSignage(signage: Signage): void {
  const chance = (value: number): boolean => value >= 0 && value <= 1
  const accents = Number.isInteger(signage.accents) && signage.accents >= 0 && signage.accents <= MOST_ACCENTS
  if (!accents || !chance(signage.blade) || !chance(signage.hanging) || !chance(signage.nameplate)) throw new SignageOutOfRange(signage)
}
