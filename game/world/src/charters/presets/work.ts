import type { ResolvedCharter } from '../../model/resolved.ts'
import { CURTAIN, INDUSTRIAL, framed, metal } from './courses.ts'
import { room, service } from './rooms.ts'
import { SOBER } from './signage.ts'

export const office: ResolvedCharter = {
  word: 'office',
  label: 'office',
  blade: 'OFFICE',
  names: ['{family} & Co.', '{family} Group', 'The {adjective} {noun} Agency'],
  rumours: ['The upstairs office has not been used in months.', 'Papers go out of here in a locked case.'],
  share: 2,
  prominence: 'background',
  residential: false,
  size: { storeys: [2, 4], sprawl: 'block' },
  street: { frontage: 'curtain', openness: 'dense', material: 'metal', voice: 'sober' },
  access: 'open',
  service: 'desk',
  work: ['desk'],
  holding: ['papers', 'personal'],
  finish: 'corporate',
  rooms: {
    hall: room('waiting-room', 'Reception'),
    main: room('desk-floor', 'Open office'),
    services: [service('private-office', 'Manager office', 1)],
  },
  built: framed(CURTAIN, metal(1), CURTAIN, 'Metal_Plain_1'),
  signage: SOBER,
  tint: 0x8a95a0,
  suits: ['office', 'curtain', 'metal', 'block', 'background'],
}

export const workshop: ResolvedCharter = {
  word: 'workshop',
  label: 'workshop',
  blade: 'REPAIRS',
  names: ['{family} Repairs', '{family} & Sons', 'The {adjective} {noun} Works'],
  rumours: ['There is a job on the bench nobody has paid for.', 'The forge is lit before anyone else in the street is awake.'],
  share: 2,
  prominence: 'background',
  residential: false,
  size: { storeys: [1, 2], sprawl: 'wide' },
  street: { frontage: 'industrial', openness: 'sparse', material: 'metal', voice: 'sober' },
  access: 'open',
  service: 'counter',
  work: ['bench', 'desk'],
  holding: ['tools'],
  finish: 'industrial',
  rooms: {
    main: room('bench-floor', 'Workshop floor'),
    services: [service('store', 'Parts store', 1), service('private-office', 'Shop office', 1, { spare: true })],
  },
  built: framed(INDUSTRIAL, metal(3), INDUSTRIAL, 'Metal_FirstFloor_Wall_1'),
  signage: { blade: 0.26, hanging: 0.4, accents: 2, nameplate: 0.7 },
  tint: 0x6a6a60,
  suits: ['workshop', 'industrial', 'metal', 'wide', 'background'],
}

export const warehouse: ResolvedCharter = {
  word: 'warehouse',
  label: 'warehouse',
  blade: 'DEPOT',
  names: ['{family} Haulage', '{family} Depot', 'The {adjective} {noun} Freight'],
  rumours: ['Half the crates in the back are addressed to one buyer.', 'The night door is used more than the day one.'],
  share: 1,
  prominence: 'background',
  residential: false,
  size: { storeys: [1, 2], sprawl: 'wide' },
  street: { frontage: 'industrial', openness: 'sparse', material: 'metal', voice: 'sober' },
  access: 'open',
  service: 'none',
  work: ['watch', 'desk'],
  holding: ['goods'],
  finish: 'industrial',
  rooms: {
    main: room('bulk-store', 'Warehouse floor'),
    services: [service('private-office', 'Foreman office', 1, { spare: true })],
  },
  built: framed(INDUSTRIAL, metal(3), INDUSTRIAL, 'Metal_FirstFloor_Wall_1'),
  signage: { blade: 0.2, hanging: 0.24, accents: 2, nameplate: 0.55 },
  tint: 0x5f5f58,
  suits: ['warehouse', 'industrial', 'metal', 'wide', 'background'],
}
