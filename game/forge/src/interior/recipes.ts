import type { BuildingKind, RoomKind } from '@gb/world'

export type RoomRole = 'hall' | 'main' | 'service'

export interface HallSpec {
  readonly kind: RoomKind
  readonly name: string
  /** Share of the depth the hall takes, between its own bounds in metres. */
  readonly share: number
  readonly min: number
  readonly max: number
}

export interface ServiceSpec {
  readonly kind: RoomKind
  readonly name: string
  readonly weight: number
  /** Rooms that only appear when the building has room to spare. */
  readonly spare?: boolean
}

export interface Programme {
  /** The room the street door opens into, when the building is deep enough for one. */
  readonly hall?: HallSpec
  readonly main: { readonly kind: RoomKind; readonly name: string }
  readonly services: readonly ServiceSpec[]
}

const foyer = (name: string): HallSpec => ({ kind: 'hall', name, share: 0.2, min: 2.2, max: 3.2 })
const lobby = (name: string): HallSpec => ({ kind: 'hall', name, share: 0.45, min: 3.4, max: 6.5 })

/** What rooms each kind of building has, before any of it is measured out. */
export const PROGRAMMES: Record<BuildingKind, Programme> = {
  bar: {
    main: { kind: 'main', name: 'Taproom' },
    services: [{ kind: 'cellar', name: 'Cellar', weight: 1 }],
  },
  cafe: {
    main: { kind: 'main', name: 'Cafe floor' },
    services: [{ kind: 'kitchen', name: 'Kitchen', weight: 1 }],
  },
  restaurant: {
    hall: foyer('Entrance'),
    main: { kind: 'main', name: 'Dining room' },
    services: [
      { kind: 'kitchen', name: 'Kitchen', weight: 2 },
      { kind: 'storage', name: 'Pantry', weight: 1, spare: true },
    ],
  },
  shop: {
    main: { kind: 'main', name: 'Shop floor' },
    services: [{ kind: 'backroom', name: 'Back room', weight: 1 }],
  },
  market: {
    main: { kind: 'main', name: 'Market hall' },
    services: [{ kind: 'storage', name: 'Store', weight: 1, spare: true }],
  },
  house: {
    hall: foyer('Entrance hall'),
    main: { kind: 'main', name: 'Living room' },
    services: [
      { kind: 'kitchen', name: 'Kitchen', weight: 1 },
      { kind: 'bedroom', name: 'Bedroom', weight: 1 },
      { kind: 'bathroom', name: 'Bathroom', weight: 1, spare: true },
    ],
  },
  apartment: {
    main: { kind: 'main', name: 'Living room' },
    services: [
      { kind: 'bedroom', name: 'Bedroom', weight: 1 },
      { kind: 'kitchen', name: 'Kitchen', weight: 1, spare: true },
    ],
  },
  office: {
    hall: foyer('Reception'),
    main: { kind: 'main', name: 'Open office' },
    services: [{ kind: 'office', name: 'Manager office', weight: 1 }],
  },
  workshop: {
    main: { kind: 'main', name: 'Workshop floor' },
    services: [
      { kind: 'storage', name: 'Parts store', weight: 1 },
      { kind: 'office', name: 'Shop office', weight: 1, spare: true },
    ],
  },
  warehouse: {
    main: { kind: 'storage', name: 'Warehouse floor' },
    services: [{ kind: 'office', name: 'Foreman office', weight: 1, spare: true }],
  },
  clinic: {
    hall: lobby('Waiting room'),
    main: { kind: 'main', name: 'Treatment room' },
    services: [{ kind: 'storage', name: 'Supply room', weight: 1, spare: true }],
  },
  hotel: {
    hall: lobby('Lobby'),
    main: { kind: 'bedroom', name: 'Guest room' },
    services: [{ kind: 'bedroom', name: 'Upper guest room', weight: 1, spare: true }],
  },
  station: {
    main: { kind: 'hall', name: 'Concourse' },
    services: [{ kind: 'office', name: 'Ticket office', weight: 1, spare: true }],
  },
  chapel: {
    main: { kind: 'main', name: 'Nave' },
    services: [{ kind: 'storage', name: 'Vestry', weight: 1, spare: true }],
  },
}
