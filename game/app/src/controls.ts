import type { ControlHint } from '@gb/hud'
import type { DrivingView } from './chase.ts'

/**
 * What the game binds, for the interface to list where the player can read it.
 * The hud adds the keys it owns (the window faces, the way out, Escape, Enter,
 * Tab) to this list itself; nothing here may collide with them.
 *
 * The driving view is the one row that reads the game rather than declaring it,
 * so the window says which of the two is on right now.
 */
export function controlsFor(view: DrivingView): readonly ControlHint[] {
  return [
    { keys: ['W', 'A', 'S', 'D'], text: 'Walk, and drive', group: 'Move' },
    { keys: ['Shift'], text: 'Run', group: 'Move' },
    { keys: ['C'], text: 'Crouch', group: 'Move' },
    { keys: ['Space'], text: 'Jump', group: 'Move' },
    { keys: ['Mouse'], text: 'Look around', group: 'Move' },
    { keys: ['Right mouse'], text: 'Look closer', group: 'Move' },
    {
      keys: ['V'],
      text: `Swap the driving view, now ${view === 'chase' ? 'from behind the car' : 'from the seat'}`,
      group: 'Move',
    },
    { keys: ['E'], text: 'Go in, talk to someone, take a thing, leave it where a job wants it, get into a car', group: 'World' },
    { keys: ['Left click'], text: 'Ask someone along, or tell them to stay', group: 'World' },
    { keys: ['G'], text: 'The way to the quest you are following', group: 'World' },
    { keys: ['T'], text: 'Turn the time of day: dawn, midday, sundown, night', group: 'Sky' },
    { keys: ['K'], text: 'Change the weather: clear, overcast, rain', group: 'Sky' },
    { keys: ['P'], text: 'Hold the clock, or let it run', group: 'Sky' },
  ]
}
