import type { ControlHint } from '@gb/hud'

/**
 * What the game binds, for the interface to list where the player can read it.
 * The hud adds the keys it owns to this list; nothing here may collide with them.
 */
export const CONTROLS: readonly ControlHint[] = [
  { keys: ['W', 'A', 'S', 'D'], text: 'Walk, and drive', group: 'Move' },
  { keys: ['Shift'], text: 'Run', group: 'Move' },
  { keys: ['C'], text: 'Crouch', group: 'Move' },
  { keys: ['Space'], text: 'Jump', group: 'Move' },
  { keys: ['Mouse'], text: 'Look around', group: 'Move' },
  { keys: ['Right mouse'], text: 'Look closer', group: 'Move' },
  { keys: ['E'], text: 'Go in, talk to someone, take a thing, leave it where a job wants it, get into a car', group: 'World' },
  { keys: ['Left click'], text: 'Ask someone along, or tell them to stay', group: 'World' },
  { keys: ['G'], text: 'The way to the quest you are following', group: 'World' },
  { keys: ['T'], text: 'Dawn, midday, sundown, midnight', group: 'Sky' },
  { keys: ['K'], text: 'Clear, overcast, rain', group: 'Sky' },
  { keys: ['P'], text: 'Hold the time of day, or let it run', group: 'Sky' },
  { keys: ['N'], text: 'New city, and export this one', group: 'World' },
]
