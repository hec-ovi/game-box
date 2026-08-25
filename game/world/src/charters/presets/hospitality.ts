import type { ResolvedCharter } from '../../model/resolved.ts'
import { PAINTED, brick, masonry } from './courses.ts'
import { room, service } from './rooms.ts'
import { LOUD, TRADE } from './signage.ts'

export const bar: ResolvedCharter = {
  word: 'bar',
  label: 'bar',
  blade: 'BAR',
  names: ["{family}'s", 'The {adjective} {noun}', '{family} Bar'],
  rumours: ['The back room is booked on the same night every week.', 'The cellar door sticks unless you lift it.'],
  share: 2,
  prominence: 'notable',
  residential: false,
  size: { storeys: [1, 2], sprawl: 'narrow' },
  street: { frontage: 'painted', openness: 'even', material: 'masonry', voice: 'loud' },
  access: 'open',
  service: 'counter',
  work: [],
  holding: ['drink', 'papers', 'valuables'],
  finish: 'corporate',
  rooms: {
    main: room('taproom', 'Taproom'),
    services: [service('store', 'Cellar', 1, { kind: 'cellar' })],
  },
  built: masonry(PAINTED, brick(2), 'DoorFrame_Trim', 'Metal_FirstFloor_Wall_1'),
  signage: LOUD,
  tint: 0x8c5a3c,
  suits: ['bar', 'painted', 'masonry', 'narrow', 'notable'],
}

export const cafe: ResolvedCharter = {
  word: 'cafe',
  label: 'cafe',
  blade: 'CAFE',
  names: ["{family}'s", '{family} Coffee', 'The {adjective} {noun} Canteen'],
  rumours: ['The morning crowd and the evening crowd never overlap.', 'Somebody left a bag here a week ago and never came back.'],
  share: 2,
  prominence: 'background',
  residential: false,
  size: { storeys: [1, 2], sprawl: 'narrow' },
  street: { frontage: 'painted', openness: 'even', material: 'masonry', voice: 'trade' },
  access: 'open',
  service: 'counter',
  work: ['cook'],
  holding: ['food', 'papers'],
  finish: 'corporate',
  rooms: {
    main: room('cafe-floor', 'Cafe floor'),
    services: [service('kitchen', 'Kitchen', 1)],
  },
  built: masonry(PAINTED, brick(2), 'DoorFrame_Trim', 'Metal_FirstFloor_Wall_1'),
  signage: TRADE,
  tint: 0x9a7a4a,
  suits: ['cafe', 'painted', 'masonry', 'narrow', 'background'],
}

export const restaurant: ResolvedCharter = {
  word: 'restaurant',
  label: 'restaurant',
  blade: 'EAT',
  names: ["{family}'s", '{family} Kitchen', 'The {adjective} {noun} Grill'],
  rumours: ['The kitchen orders more than the tables can eat.', 'One table is kept free most nights, for nobody in particular.'],
  share: 1,
  prominence: 'background',
  residential: false,
  size: { storeys: [1, 2], sprawl: 'narrow' },
  street: { frontage: 'painted', openness: 'even', material: 'masonry', voice: 'loud' },
  access: 'open',
  service: 'counter',
  work: ['cook'],
  holding: ['food', 'drink', 'papers'],
  finish: 'corporate',
  rooms: {
    hall: room('entrance-hall', 'Entrance'),
    main: room('dining-room', 'Dining room'),
    services: [service('kitchen', 'Kitchen', 2), service('store', 'Pantry', 1, { spare: true })],
  },
  built: masonry(PAINTED, brick(2), 'DoorFrame_Trim', 'Metal_FirstFloor_Wall_1'),
  signage: LOUD,
  tint: 0x8a4a4a,
  suits: ['restaurant', 'painted', 'masonry', 'narrow', 'background'],
}
