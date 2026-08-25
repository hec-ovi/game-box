import { z } from 'zod'

/** An id of one kind, as `IdMinter` writes it: `npc_0001`, four digits at least. */
export const id = (kind: string) =>
  z
    .string()
    .regex(new RegExp(`^${kind}_\\d{4,}$`), `expected a ${kind} id like ${kind}_0001`)
