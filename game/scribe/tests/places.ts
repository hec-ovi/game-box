import type { InstanceBrief } from '@gb/forge'
import { SHIPPED_CHARTERS, type Charter, type Word } from '@gb/world'

/** The preset charter behind a word, which is what the forge hands over for a kind every town has. */
export function charterOf(word: Word): Charter {
  return SHIPPED_CHARTERS.find((charter) => charter.word === word)!
}

/** The architecture every request about a building carries: how tall it stands, how big its floor is and whether it is on an avenue. */
export const STANDING = { storeys: 2, floor: { frontage: 8, depth: 12 }, onAvenue: false } as const

/** A plan that put nothing in the place: no lock, no screen, no camera, not for sale. */
export const PLAIN: InstanceBrief = { locked: [], machines: [], camera: false }

/** A kind of place no preset is, as a history would declare it. */
export const JAIL: Charter = {
  word: 'jail',
  label: 'jail',
  blade: 'JAIL',
  names: ['{family} Street Jail', 'The {adjective} House'],
  rumours: ['Nobody who goes in the side door comes out the front.'],
  share: 1,
  prominence: 'landmark',
  residential: false,
  size: { storeys: [2, 3], sprawl: 'wide' },
  street: { frontage: 'blank', openness: 'sparse', material: 'masonry', voice: 'sober' },
  access: 'admitted',
  service: 'desk',
  work: ['watch'],
  holding: ['papers', 'valuables'],
  finish: 'civic',
  rooms: {
    hall: { use: 'lobby', name: 'Duty desk' },
    main: { use: 'ward', name: 'Cells' },
    services: [{ use: 'private-office', name: 'Warden', weight: 1, shut: true }],
  },
}
