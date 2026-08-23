import type { ControlHint } from '@gb/hud'

/**
 * What the game binds, for the interface to list where the player can read it.
 * The hud adds the keys it owns to this list; nothing here may collide with them.
 */
export const CONTROLS: readonly ControlHint[] = [
  { keys: ['W', 'A', 'S', 'D'], text: 'Walk', group: 'Move' },
  { keys: ['Shift'], text: 'Run', group: 'Move' },
  { keys: ['C'], text: 'Crouch', group: 'Move' },
  { keys: ['Space'], text: 'Jump', group: 'Move' },
  { keys: ['Mouse'], text: 'Look around', group: 'Move' },
  { keys: ['Right mouse'], text: 'Look closer', group: 'Move' },
  { keys: ['E'], text: 'Go in, talk to someone, take a thing', group: 'World' },
  { keys: ['Left click'], text: 'Ask someone along, or tell them to stay', group: 'World' },
  { keys: ['N'], text: 'New city, and export this one', group: 'World' },
]
