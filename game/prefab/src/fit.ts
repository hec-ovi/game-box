/**
 * How exactly a baked model has to fit the plot it was baked for. The pack
 * builder refuses anything outside these, so nothing at load time has to
 * measure a mesh or hope.
 */

/**
 * How far the lit trim on a building may reach past its plot: a neon tube and
 * the bracket it stands on, sideways at the shopfront and upwards at the
 * parapet. Plots in a block abut, so a building already shares its relief with
 * the one next door: `@gb/kitbash` reaches 5 cm with its window trim and 8 cm
 * with a flat sign, and this is the same arrangement one step louder. Nothing
 * hangs out over the street the way a kit blade sign does.
 */
export const PROUD = 0.2

/**
 * How far the walls themselves may sit off the height the city puts the plot
 * at. The mass is exact; only the trim is allowed the budget above.
 */
export const HEIGHT_TOLERANCE = 0.001
