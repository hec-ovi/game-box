import type { MachineProgram } from '@gb/world'
import { blank } from './blank.ts'
import { feed } from './feed.ts'
import { idle } from './idle.ts'
import { ledger } from './ledger.ts'
import { mail } from './mail.ts'
import type { Program } from './page.ts'

/** One drawing per program a screen can run: exhaustive over `MACHINE_PROGRAMS`. */
export const PROGRAMS: Record<MachineProgram, Program> = {
  ledger,
  'camera-feed': feed,
  mail,
  snake: idle,
  tetris: idle,
  blank,
}
