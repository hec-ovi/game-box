import type { WorldSummary } from '@gb/forge'

/**
 * A town with every second-wave thing in it: a disco with a cellar behind a
 * lock, a guard behind it and a game screen on its bar, an office with a locked
 * screen and a priced thing on its counter, a house for sale, a garage with a
 * bench, which is where a car reward comes from, and a depot whose strongroom
 * takes a code nobody in it can be asked for.
 */
export const LOCKED: WorldSummary = {
  cityName: 'Cold Harbour',
  theme: 'neon port',
  places: [
    {
      plotId: 'plot_0001',
      interiorId: 'interior_0001',
      kind: 'disco',
      name: 'The Pulse',
      door: { x: 0, z: 0 },
      npcs: [
        { npcId: 'npc_0001', name: 'Boaz Sellers', role: 'guard', roomId: 'room_0001' },
        { npcId: 'npc_0002', name: 'Neve Vesper', role: 'bartender', roomId: 'room_0002' },
        { npcId: 'npc_0003', name: 'Vidya Sellers', role: 'guard', roomId: 'room_0003' },
      ],
      items: [{ itemId: 'item_0002', name: 'Worn glass', ownerNpcId: 'npc_0002', value: 3, roomId: 'room_0003' }],
      locks: [
        { doorId: 'door_0003', room: 'Cellar', roomId: 'room_0003', street: false, keyItemId: 'item_0001', keeperNpcId: 'npc_0002', behind: ['item_0002'] },
      ],
      machines: [{ machineId: 'machine_0001', program: 'snake', locked: false, roomId: 'room_0002' }],
    },
    {
      plotId: 'plot_0002',
      interiorId: 'interior_0002',
      kind: 'office',
      name: 'Zhen Group',
      door: { x: 60, z: 0 },
      npcs: [{ npcId: 'npc_0004', name: 'Vidya Mott', role: 'receptionist', roomId: 'room_0004' }],
      items: [{ itemId: 'item_0003', name: 'Wrapped ledger', ownerNpcId: 'npc_0004', value: 21, roomId: 'room_0004' }],
      locks: [],
      machines: [{ machineId: 'machine_0002', program: 'mail', locked: true, password: 'bramble-80', roomId: 'room_0005' }],
    },
    {
      plotId: 'plot_0003',
      interiorId: 'interior_0003',
      kind: 'house',
      name: '10 Mill Avenue',
      door: { x: 120, z: 0 },
      forSale: 4693,
      npcs: [],
      items: [{ itemId: 'item_0004', name: 'Battered statue', value: 205, roomId: 'room_0006' }],
      locks: [],
      machines: [],
    },
    {
      plotId: 'plot_0004',
      interiorId: 'interior_0004',
      kind: 'garage',
      name: 'Ketch Motors',
      door: { x: 180, z: 0 },
      work: ['bench'],
      npcs: [{ npcId: 'npc_0005', name: 'Orrin Vesper', role: 'mechanic', roomId: 'room_0007' }],
      items: [],
      locks: [],
      machines: [],
    },
    {
      plotId: 'plot_0005',
      interiorId: 'interior_0005',
      kind: 'depot',
      name: 'Halloran Depot',
      door: { x: 240, z: 0 },
      npcs: [],
      items: [{ itemId: 'item_0005', name: 'Sealed crate', roomId: 'room_0008' }],
      locks: [
        { doorId: 'door_0004', room: 'Strongroom', roomId: 'room_0008', street: false, password: 'quill-12', behind: ['item_0005'] },
      ],
      machines: [],
    },
  ],
}

/** The whole of a sheet that is not the beats: the office's receptionist hands it out. */
export function lockedSheet(beats: unknown[], extra: Record<string, unknown> = {}) {
  return {
    id: 'quest_0001',
    kind: 'main' as const,
    title: 'Behind the door at The Pulse',
    summary: 'Vidya wants the glass from the cellar.',
    giverNpcId: 'npc_0004',
    beats,
    reward: { money: 45, reputation: 3, faction: 'town', items: [] },
    ...extra,
  }
}

export const KEY_RUN = [
  { kind: 'talk', npcId: 'npc_0002', hands: [{ kind: 'give-item', itemId: 'item_0001' }], objective: 'Get the cellar key off Neve' },
  { kind: 'unlock', doorId: 'door_0003', objective: 'Open the cellar door' },
  { kind: 'collect', itemId: 'item_0002', allowSteal: true, objective: 'Take the glass from the cellar' },
  { kind: 'deliver', itemId: 'item_0002', toNpcId: 'npc_0004', objective: 'Bring Vidya the glass' },
]

export const HACK_JOB = [
  { kind: 'talk', npcId: 'npc_0002', hands: [{ kind: 'give-password', password: 'bramble-80' }], objective: 'Get the code off Neve' },
  { kind: 'hack', machineId: 'machine_0002', objective: 'Read the mail at Zhen Group' },
  { kind: 'talk', npcId: 'npc_0004', objective: 'Tell Vidya what it said' },
]

export const HIGH_SCORE = [
  { kind: 'beat-game', machineId: 'machine_0001', score: 40, objective: 'Beat 40 at snake on the bar screen' },
  { kind: 'talk', npcId: 'npc_0004', objective: 'Collect from Vidya' },
]

export const SHOPPING = [
  { kind: 'buy', itemId: 'item_0003', objective: 'Buy the ledger over the counter at Zhen Group' },
  { kind: 'deliver', itemId: 'item_0003', toNpcId: 'npc_0002', objective: 'Bring Neve the ledger' },
]
