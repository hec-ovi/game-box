import type { AccessKind, Charter, Service, WorkKind } from '@gb/world'
import { bullets, prompt } from './prompts.ts'

const FRONT: Record<Service, string> = {
  none: 'no counter at the front',
  counter: 'a counter at the front with somebody behind it',
  desk: 'a desk at the front with somebody at it',
  stalls: 'stalls at the front',
}

const WORK: Record<WorkKind, string> = {
  desk: 'desk work',
  bench: 'bench work',
  cook: 'cooking',
  floor: 'work on the floor',
  watch: 'somebody keeping watch',
}

const ACCESS: Record<AccessKind, string> = {
  open: 'anybody may walk in',
  admitted: 'the public gets as far as the front room',
  private: 'nobody comes in without a key',
}

/**
 * What a kind of place is, in the words a prompt reads. A charter is a row of
 * closed choices; a model writing a jail's people has to be told what a jail is
 * here, and this is the whole of it: the post at the front, the work, what it
 * keeps, who gets in, its rooms, and what people say about such places.
 */
export function charterLines(charter: Charter): string {
  const work = charter.work.map((kind) => WORK[kind])
  const rooms = [charter.rooms.hall, charter.rooms.main, ...charter.rooms.services].flatMap((room) => (room ? [room.name] : []))
  return prompt('charter', {
    label: charter.label,
    front: FRONT[charter.service],
    work: work.length ? `people here do ${work.join(' and ')}` : 'nobody works past the front',
    holding: charter.holding.length ? `it keeps ${charter.holding.join(', ')}` : 'it keeps nothing much',
    access: ACCESS[charter.access],
    rooms: rooms.join(', '),
    rumours: bullets(charter.rumours, 'Nothing in particular.'),
  })
}
