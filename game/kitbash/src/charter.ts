import type { ResolvedCharter } from '@gb/world'

/**
 * What this box reads off a plot's charter: the pieces its walls are made of,
 * how loud its signage is, and the word down its blade. The world resolved
 * every one of them once, so nothing here holds a table of kinds.
 */
export type PlotCharter = Pick<ResolvedCharter, 'built' | 'signage' | 'blade'>
