import type { Charter, ResolvedCharter } from '@gb/world'
import { PLACEHOLDER_KIND } from '../naming/placeholders.ts'
import { resolve } from './resolve.ts'

/**
 * What a building is while it is only a building.
 *
 * The architecture cuts footprints, entrances and heights; it does not say that
 * one of them is a bar and another a station, because that is what a place is
 * and what a place is belongs to the writing. But a plot in a world document
 * has to name a kind of place the city declares, so every plot goes up under
 * this one and the writing writes over it: the instances before the work is
 * written, the frontage with its sign.
 *
 * It is the same idea as `Instance 1` and `Zone 2`: the architecture saying
 * what it has, not a gap where an answer goes. It is a plain wall with a door
 * and ordinary windows, it holds nobody and sells nothing, and its sign says
 * only that there is a building here.
 */
const ARCHITECTURE: Charter = {
  word: PLACEHOLDER_KIND,
  label: 'building',
  blade: 'BUILDING',
  names: ['{family} {noun}', 'The {adjective} {noun}'],
  rumours: [],
  share: 1,
  prominence: 'background',
  residential: false,
  size: { storeys: [1, 4], sprawl: 'wide' },
  street: { frontage: 'blank', openness: 'even', material: 'masonry', voice: 'quiet' },
  access: 'open',
  service: 'none',
  work: [],
  holding: [],
  finish: 'civic',
  rooms: { main: { use: 'lobby', name: 'Room' }, services: [] },
}

/** The charter every plot stands under until the writing says what the building is. */
export const PLACEHOLDER_CHARTER: ResolvedCharter = resolve(ARCHITECTURE)
