import type { Charter } from '@gb/world'

/**
 * The kinds of place an offline history can declare beyond the presets, keyed
 * by word. A trade or a turn in `premise/*.md` names one under `declares`, and
 * the composer writes it into the history beside the premise, so a town written
 * around its clubs is founded with a disco in its charters.
 */
export const PLACES: Readonly<Record<string, Charter>> = {
  disco: {
    word: 'disco',
    label: 'disco',
    blade: 'DISCO',
    names: ["{family}'s", 'The {adjective} {noun}', 'Club {noun}'],
    rumours: ['The doorman decides who dances and who waits.', 'The music stops at four and the arguments start.'],
    share: 1,
    prominence: 'notable',
    residential: false,
    size: { storeys: [1, 2], sprawl: 'wide' },
    street: { frontage: 'painted', openness: 'sparse', material: 'mixed', voice: 'loud' },
    access: 'open',
    service: 'counter',
    work: ['watch'],
    holding: ['drink', 'valuables'],
    finish: 'worn',
    rooms: {
      hall: { use: 'entrance-hall', name: 'Door' },
      main: { use: 'taproom', name: 'Dance floor' },
      services: [{ use: 'store', name: 'Cellar', kind: 'cellar', weight: 1 }],
    },
  },
}
