import type { InstanceBrief } from '@gb/forge'
import type { MachineProgram } from '@gb/world'
import { prompt } from './prompts.ts'

const OPENED_BY: Record<InstanceBrief['locked'][number]['by'], string> = {
  key: 'a key somebody here carries',
  card: 'a card somebody here carries',
  code: 'a code typed at the door',
}

const RUNS: Record<MachineProgram, string> = {
  ledger: 'the ledger',
  'camera-feed': 'the camera feed',
  mail: 'the mail',
  snake: 'a game of snake',
  tetris: 'a game of tetris',
  blank: 'nothing yet',
}

/**
 * What the plan put in a place, in the words the place writer reads: which
 * rooms are behind a lock and what opens each, which screens are on and what
 * they run, whether a camera watches the door, and whether the place is for
 * sale. The writer is told so the people it writes know what they keep.
 */
export function briefLines(has: InstanceBrief): string {
  const lines: string[] = []
  if (has.locked.length) {
    lines.push(`Behind a lock: ${has.locked.map((room) => `the ${room.room} (${OPENED_BY[room.by]})`).join('; ')}.`)
  }
  if (has.machines.length) {
    lines.push(`Screens: ${has.machines.map((machine) => `one in the ${machine.room} running ${RUNS[machine.program]}`).join('; ')}.`)
  }
  if (has.camera) lines.push('A camera watches the front room.')
  if (has.forSale !== undefined) lines.push(`The place is for sale at ${has.forSale} credits, and nobody lives in it.`)
  return lines.length ? lines.join('\n') : prompt('plain-place')
}
