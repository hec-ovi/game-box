import type { CharterRoom, CharterService } from '../../model/charter.ts'
import type { RoomUse } from '../../model/traits.ts'
import type { RoomKind } from '../../model/vocabulary.ts'

export const room = (use: RoomUse, name: string, kind?: RoomKind): CharterRoom => ({ use, name, ...(kind ? { kind } : {}) })

export const service = (
  use: RoomUse,
  name: string,
  weight: number,
  extra: { spare?: true; kind?: RoomKind } = {},
): CharterService => ({ ...room(use, name, extra.kind), weight, ...(extra.spare ? { spare: true } : {}) })
