import type { ResolvedCharter } from '../../model/resolved.ts'
import { MASONRY, PAINTED, brick, masonry } from './courses.ts'
import { room, service } from './rooms.ts'
import { QUIET } from './signage.ts'

export const house: ResolvedCharter = {
  word: 'house',
  label: 'house',
  blade: 'HOME',
  names: ['{family} House', 'The {adjective} {noun}', '{family} Cottage'],
  rumours: ['The neighbours argue on the same night each week.', 'A room in this house is kept locked.'],
  share: 10,
  prominence: 'background',
  residential: true,
  size: { storeys: [1, 2], sprawl: 'narrow' },
  street: { frontage: 'masonry', openness: 'even', material: 'masonry', voice: 'quiet' },
  access: 'open',
  service: 'none',
  work: ['cook'],
  holding: ['personal', 'papers', 'valuables'],
  finish: 'domestic',
  rooms: {
    hall: room('entrance-hall', 'Entrance hall'),
    main: room('living-room', 'Living room'),
    services: [service('kitchen', 'Kitchen', 1), service('bedroom', 'Bedroom', 1), service('washroom', 'Bathroom', 1, { spare: true })],
  },
  built: masonry(MASONRY, brick(2, 'Brick_Window_Square_Single'), 'DoorFrame_Trim', 'Brick_Plain_1'),
  signage: QUIET,
  tint: 0x9a8a76,
  suits: ['house', 'masonry', 'narrow', 'background'],
}

export const apartment: ResolvedCharter = {
  word: 'apartment',
  label: 'apartment block',
  blade: 'ROOMS',
  names: ['{family} Apartments', '{family} Court', 'The {adjective} {noun} Mansions'],
  rumours: ['Nobody knows who lives on the top floor.', 'The stairwell light has been out since spring.'],
  share: 3,
  prominence: 'background',
  residential: true,
  size: { storeys: [3, 4], sprawl: 'block' },
  street: { frontage: 'masonry', openness: 'dense', material: 'masonry', voice: 'quiet' },
  access: 'open',
  service: 'none',
  work: ['cook'],
  holding: ['personal', 'papers'],
  finish: 'domestic',
  rooms: {
    main: room('living-room', 'Living room'),
    services: [service('bedroom', 'Bedroom', 1), service('kitchen', 'Kitchen', 1, { spare: true })],
  },
  built: masonry(MASONRY, brick(1, 'Brick_Window_Square_Single'), 'DoorFrame_Trim', 'Brick_Plain_1'),
  signage: { blade: 0.2, hanging: 0.2, accents: 3, nameplate: 0.4 },
  tint: 0x8a8276,
  suits: ['apartment', 'masonry', 'block', 'background'],
}

export const hotel: ResolvedCharter = {
  word: 'hotel',
  label: 'hotel',
  blade: 'HOTEL',
  names: ['{family} Hotel', 'The {adjective} {noun} Inn', '{family} Rooms'],
  rumours: ['One room has been paid for a month in advance and never slept in.', 'The register has more names than there are guests.'],
  share: 1,
  prominence: 'notable',
  residential: false,
  size: { storeys: [2, 4], sprawl: 'block' },
  street: { frontage: 'painted', openness: 'dense', material: 'masonry', voice: 'loud' },
  access: 'open',
  service: 'desk',
  work: [],
  holding: ['personal', 'papers'],
  finish: 'domestic',
  rooms: {
    hall: room('lobby', 'Lobby'),
    main: room('guest-room', 'Guest room'),
    services: [service('guest-room', 'Upper guest room', 1, { spare: true })],
  },
  built: masonry(PAINTED, brick(1), 'DoorFrame_Trim', 'Metal_FirstFloor_Wall_1'),
  signage: { blade: 0.9, hanging: 0.52, accents: 4, nameplate: 1 },
  tint: 0x8a7a9a,
  suits: ['hotel', 'painted', 'masonry', 'block', 'notable'],
}
