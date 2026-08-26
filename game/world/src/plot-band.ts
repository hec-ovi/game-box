import type { Plot } from './model/schema.ts'

/**
 * How a city is cut: the sizes a plot comes in, in grid cells. The generator
 * cuts inside the band and the art is drawn for it, so the band lives here,
 * with the city, and neither side carries a copy.
 */

export interface CellRange {
  readonly min: number
  readonly max: number
}

export const PLOT_BAND = {
  /** Cells across the face the door is on. */
  frontage: { min: 3, max: 6 },
  /** Cells back from that face. */
  depth: { min: 5, max: 8 },
  /** Storeys the catalogue is drawn for. A taller plot is dressed from the kit. */
  storeys: { min: 1, max: 4 },
} as const satisfies Record<string, CellRange>

/**
 * The tallest a plot may stand, in storeys, and so the tallest a brief or a
 * form may ask for. It is the document's own limit: a world file carries this
 * number and `load` refuses one past it.
 *
 * A footprint outside the band is a shape nothing can draw, so the generator
 * never cuts one. Height is different: the kit builds a wall a storey at a
 * time and goes as high as it is told, so a plot past `PLOT_BAND.storeys.max`
 * is a sound city that draws from the kit rather than the catalogue. That is
 * what lets a town have a skyline out of art drawn for four storeys.
 */
export const TALLEST_STOREYS = 40

/** A plot's size read in its door's frame, in cells. */
export interface PlotShape {
  readonly frontage: number
  readonly depth: number
  readonly storeys: number
}

/**
 * The shape of a plot as its building sees it: a door on an east or west wall
 * is the same shape turned a quarter, so frontage is measured across the wall
 * the door is on.
 */
export function plotShape(plot: Pick<Plot, 'rect' | 'entrance' | 'storeys'>): PlotShape {
  const acrossX = plot.entrance.facing === 'north' || plot.entrance.facing === 'south'
  return {
    frontage: acrossX ? plot.rect.w : plot.rect.h,
    depth: acrossX ? plot.rect.h : plot.rect.w,
    storeys: plot.storeys,
  }
}

/** True when every side of the shape is inside the band. */
export function inPlotBand(shape: PlotShape): boolean {
  const within = (value: number, range: CellRange) => value >= range.min && value <= range.max
  return within(shape.frontage, PLOT_BAND.frontage) && within(shape.depth, PLOT_BAND.depth) && within(shape.storeys, PLOT_BAND.storeys)
}
