import type { ResolvedCharter } from '../../model/resolved.ts'
import { GLAZED, brick, masonry } from './courses.ts'
import { room, service } from './rooms.ts'
import { TRADE } from './signage.ts'

export const shop: ResolvedCharter = {
  word: 'shop',
  label: 'shop',
  blade: 'SHOP',
  names: ["{family}'s", '{family} Supply', 'The {adjective} {noun} Stores'],
  rumours: ['Stock goes missing in ones, never in fives.', 'The good goods come in on the same day as the post.'],
  share: 3,
  prominence: 'background',
  residential: false,
  size: { storeys: [1, 2], sprawl: 'narrow' },
  street: { frontage: 'shopfront', openness: 'dense', material: 'mixed', voice: 'trade' },
  access: 'open',
  service: 'counter',
  work: ['floor'],
  holding: ['goods', 'valuables', 'personal'],
  finish: 'corporate',
  rooms: {
    main: room('shop-floor', 'Shop floor'),
    services: [service('store', 'Back room', 1, { kind: 'backroom' })],
  },
  built: masonry(GLAZED, brick(1), 'DoorFrame_Metal_Single', 'Metal_FirstFloor_Wall_1'),
  signage: TRADE,
  tint: 0x7a7a9a,
  suits: ['shop', 'shopfront', 'mixed', 'narrow', 'background'],
}

export const market: ResolvedCharter = {
  word: 'market',
  label: 'market',
  blade: 'MARKET',
  names: ['{family} Market', 'The {adjective} {noun} Exchange', '{family} Stalls'],
  rumours: ['The best stalls are gone by mid morning.', 'Two traders here refuse to stand next to each other.'],
  share: 1,
  prominence: 'notable',
  residential: false,
  size: { storeys: [1, 2], sprawl: 'wide' },
  street: { frontage: 'shopfront', openness: 'even', material: 'mixed', voice: 'trade' },
  access: 'open',
  service: 'stalls',
  work: ['floor'],
  holding: ['goods', 'valuables'],
  finish: 'corporate',
  rooms: {
    main: room('market-hall', 'Market hall'),
    services: [service('store', 'Store', 1, { spare: true })],
  },
  built: masonry(GLAZED, brick(2), 'DoorFrame_Metal_Single', 'Metal_FirstFloor_Wall_1'),
  signage: TRADE,
  tint: 0x9a8a5a,
  suits: ['market', 'shopfront', 'mixed', 'wide', 'notable'],
}
