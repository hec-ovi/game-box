import type { Rng } from '@gb/kit'
import { isMachineProp, type Charter, type Furniture, type MachineProgram } from '@gb/world'
import { codeFor } from './codes.ts'
import type { Mint } from './room-plan.ts'

/** The programs that are a game: a screen running one is open to anybody, and a quest can ask for a score on it. */
export const GAMES: readonly MachineProgram[] = ['snake', 'tetris']

export interface MachineSetting {
  readonly charter: Charter
  /** Whether a camera hangs in the place: then one screen shows what it sees. */
  readonly watched: boolean
  readonly mint: Mint
  readonly rng: Rng
}

/**
 * Decides what every screen in a place runs and whether it is locked, and
 * which room every camera watches. The dressers put the screens down as
 * geometry; this is the brief: a screen on a bar runs a game, the first screen
 * in a watched place shows the camera, the first at a counter that keeps
 * papers holds the ledger, and the rest are mail or a blank desk. Every screen that is
 * not a game is locked behind a code, because people lock their screens, and
 * the code is what a quest hands out.
 */
export function stampMachines(furniture: readonly Furniture[], setting: MachineSetting): Furniture[] {
  const hosts = new Map(furniture.map((piece) => [piece.id, piece.prop]))
  const shown = { feed: false, ledger: false }
  return furniture.map((piece) => {
    if (piece.prop === 'camera') return { ...piece, watches: piece.roomId }
    if (!isMachineProp(piece.prop)) return piece
    const program = programFor(piece.on ? hosts.get(piece.on) : undefined, setting, shown)
    const locked = !GAMES.includes(program)
    return { ...piece, machine: { id: setting.mint('machine'), program, locked, ...(locked ? { password: codeFor(setting.rng) } : {}) } }
  })
}

function programFor(host: string | undefined, setting: MachineSetting, shown: { feed: boolean; ledger: boolean }): MachineProgram {
  if (host === 'bar-counter') return setting.rng.pick(GAMES)
  if (setting.watched && !shown.feed) {
    shown.feed = true
    return 'camera-feed'
  }
  if (setting.charter.service !== 'none' && setting.charter.holding.includes('papers') && !shown.ledger) {
    shown.ledger = true
    return 'ledger'
  }
  return setting.rng.weighted([
    ['mail', 3],
    ['blank', 1],
  ])
}

/** Whether a place keeps an eye on its door: one that keeps watch, or one that admits people only so far. */
export function keepsWatch(charter: Charter): boolean {
  return charter.work.includes('watch') || charter.access !== 'open'
}
