import { roomKindOf, type Charter, type CharterService, type RoomKind, type RoomUse } from '@gb/world'

/** One room a building is cut for: the label it is cut under, the routine that dresses it, and what it is called. */
export interface RoomSpec {
  readonly kind: RoomKind
  readonly use: RoomUse
  readonly name: string
  /** Behind a locked door, in a place that admits people only so far. */
  readonly shut?: boolean
}

export interface HallSpec extends RoomSpec {
  /** Share of the depth the hall takes, between its own bounds in metres. */
  readonly share: number
  readonly min: number
  readonly max: number
}

export interface ServiceSpec extends RoomSpec {
  readonly weight: number
  /** Rooms that only appear when the building has room to spare. */
  readonly spare?: boolean
}

export interface Programme {
  /** The room the street door opens into, when the building is deep enough for one. */
  readonly hall?: HallSpec
  readonly main: RoomSpec
  readonly services: readonly ServiceSpec[]
}

/** A hall you pass through: a strip inside the door. */
const FOYER = { share: 0.2, min: 2.2, max: 3.2 }

/** A hall people wait in: deep enough for a desk and somewhere to sit. */
const LOBBY = { share: 0.45, min: 3.4, max: 6.5 }

/** What rooms a kind of building has, read off its charter before any of it is measured out. */
export function programmeOf(charter: Charter): Programme {
  const { hall, main, services } = charter.rooms
  return {
    ...(hall ? { hall: { ...room(hall), ...(hall.use === 'entrance-hall' ? FOYER : LOBBY) } } : {}),
    main: room(main),
    services: services.map((service) => ({
      ...room(service),
      weight: service.weight,
      ...(service.spare ? { spare: true } : {}),
      ...(service.shut ? { shut: true } : {}),
    })),
  }
}

const room = (spec: Charter['rooms']['main'] | CharterService): RoomSpec => ({
  kind: roomKindOf(spec),
  use: spec.use,
  name: spec.name,
  ...('shut' in spec && spec.shut ? { shut: true } : {}),
})
