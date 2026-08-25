import type { ResolvedCharter } from '@gb/world'

/**
 * What this box reads off a plot's charter: the pieces its walls are made of,
 * how loud its signage is, the word down its blade, whether its door is a
 * subway entrance and whether the place is private enough to watch its door.
 * The world resolved every one of them once, so nothing here holds a table of
 * kinds.
 */
export type PlotCharter = Pick<ResolvedCharter, 'built' | 'signage' | 'blade' | 'access' | 'transit'>
