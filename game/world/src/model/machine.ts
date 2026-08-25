import { z } from 'zod'
import { id } from './ids.ts'

/**
 * A screen somebody can use. The prop is the body on the desk; the machine is
 * what the app opens when the player or a person sits at it: locked or not,
 * the password that opens it when the quest handed one out, and the program
 * its screen runs.
 */

/** The furniture kinds that are a machine. Every piece of one carries a `machine`. */
export const MACHINE_PROPS = ['terminal', 'laptop', 'tablet', 'monitor'] as const

/** What a screen runs: one value per app that exists. `blank` is a screen with nothing open. */
export const MACHINE_PROGRAMS = ['ledger', 'camera-feed', 'mail', 'snake', 'tetris', 'blank'] as const

/** Free text a quest hands out, typed to open a machine or a door. */
export const PasswordSchema = z.string().min(1).max(60)

export const MachineSchema = z.object({
  id: id('machine'),
  locked: z.boolean().default(false),
  /** The password that opens it, when locked and one was written. */
  password: PasswordSchema.optional(),
  program: z.enum(MACHINE_PROGRAMS),
})

export type MachineProp = (typeof MACHINE_PROPS)[number]
export type MachineProgram = (typeof MACHINE_PROGRAMS)[number]
export type Machine = z.infer<typeof MachineSchema>

export const isMachineProp = (prop: string): prop is MachineProp => (MACHINE_PROPS as readonly string[]).includes(prop)
