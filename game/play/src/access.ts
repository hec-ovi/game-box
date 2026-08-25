/** Something a lock gives way to: one door, or an interior's street door. The ids are names, never looked up. */
import type { AccessDoc } from './schema.ts'
import { named } from './named.ts'

export type Access = AccessDoc

/** The id an access names, whichever side it is written from. */
const idOf = (access: Access): string => ('doorId' in access ? access.doorId : access.interiorId)

/** Whether it names a door or an interior. */
const sideOf = (access: Access): 'door' | 'interior' => ('doorId' in access ? 'door' : 'interior')

export const isAccess = (access: Access): boolean => named(idOf(access))

export const sameAccess = (a: Access, b: Access): boolean => sideOf(a) === sideOf(b) && idOf(a) === idOf(b)

/** A copy holding only the one id, so a save never carries both sides at once. */
export const copyAccess = (access: Access): Access =>
  'doorId' in access ? { doorId: access.doorId } : { interiorId: access.interiorId }
