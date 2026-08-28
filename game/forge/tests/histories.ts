import type { Charter } from '@gb/world'
import type { History } from '../src/index.ts'

/**
 * Histories a narrator might write, for the tests to lay towns out against:
 * kinds of place the engine has no word for, written the way a history writes
 * them, one of them admitting people only so far and one private.
 */

/** A jail: a duty desk, cells, a guard on the door, and an evidence room behind a locked gate. */
export const JAIL: Charter = {
  word: 'jail',
  label: 'jail',
  blade: 'JAIL',
  names: ['{family} Holding', 'The {adjective} {noun} House'],
  rumours: ['Somebody in the cells has not been charged with anything.', 'The duty desk keeps two ledgers.'],
  share: 1,
  prominence: 'landmark',
  residential: false,
  size: { storeys: [2, 3], sprawl: 'block' },
  street: { frontage: 'blank', openness: 'sparse', material: 'masonry', voice: 'sober' },
  access: 'admitted',
  service: 'desk',
  work: ['watch', 'desk'],
  holding: ['papers', 'valuables'],
  finish: 'civic',
  rooms: {
    hall: { use: 'waiting-room', name: 'Duty desk' },
    main: { use: 'ward', name: 'Cells' },
    services: [
      { use: 'store', name: 'Evidence room', weight: 1, shut: true },
      { use: 'private-office', name: 'Warden office', weight: 1, spare: true },
    ],
  },
}

/** A villa: somebody's home behind a locked street door, a card in their pocket and a code on the door. */
export const VILLA: Charter = {
  word: 'villa',
  label: 'villa',
  blade: 'VILLA',
  names: ['{family} House', 'The {adjective} {noun}'],
  rumours: ['Nobody gets past the front door without the code.'],
  share: 1,
  prominence: 'notable',
  residential: true,
  size: { storeys: [2, 2], sprawl: 'wide' },
  street: { frontage: 'painted', openness: 'even', material: 'masonry', voice: 'quiet' },
  access: 'private',
  service: 'none',
  work: ['cook'],
  holding: ['valuables', 'personal'],
  finish: 'domestic',
  rooms: {
    hall: { use: 'entrance-hall', name: 'Hall' },
    main: { use: 'living-room', name: 'Drawing room' },
    services: [
      { use: 'kitchen', name: 'Kitchen', weight: 1 },
      { use: 'bedroom', name: 'Bedroom', weight: 1 },
    ],
  },
}

/** A town whose history says there is a jail and a villa, and says what each is. */
export const LOCKUP: History = {
  livesOn: 'the county court, and everybody who has to come to it',
  happened: 'the assizes moved here from the city and brought the cells with them',
  stake: 'who is inside when the door shuts',
  sides: [
    { name: 'the court', wants: 'the cells full and the ledger clean' },
    { name: 'the families outside', wants: 'somebody to tell them who is in there' },
  ],
  common: ['the jail takes in more on market day than the court ever sees'],
  build: { moreOf: ['jail', 'office'], fewerOf: ['hotel'], mustHave: ['jail', 'villa'] },
  charters: [JAIL, VILLA],
}

/**
 * A town the line runs under: its history demands a station, in a town so small
 * that the five hundred metre spacing asks for none.
 */
export const UNDERGROUND: History = {
  livesOn: 'the line that runs under it and the freight it still carries',
  happened: 'the trains stopped calling and the platforms were left standing',
  stake: 'whether anything stops here again',
  sides: [
    { name: 'the commuters', wants: 'the line reopened and the trains calling' },
    { name: 'the operator', wants: 'the tunnels sold off before the winter' },
  ],
  common: ['the escalators still run at night with nobody on them'],
  build: { moreOf: ['office'], fewerOf: ['hotel'], mustHave: ['station'] },
}
