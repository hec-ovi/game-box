import type { Finish, ResolvedCharter } from '@gb/world'
import type { FurnishStyle } from './style/palette.ts'

/**
 * How one interior is dressed: the language its furniture and surfaces come
 * out in, the finish its walls draw their taste from, and the charter a room's
 * use is read off when the file left `Room.use` out.
 */
export interface RoomDress {
  readonly style: FurnishStyle
  readonly finish: Finish
  readonly charter: ResolvedCharter | undefined
}
