/**
 * What each family of surface is made of, as the numbers a derived map is aimed
 * at. One row per real material, not per image, so two pictures of weathering
 * steel are derived the same way.
 *
 * `relief` is the target, in millimetres peak to peak: how deep the material
 * really is, measured off what the thing is rather than off what the photograph
 * happened to expose at. The tool stretches the tile's own contrast onto it, so
 * a flat photograph and a contrasty one of the same material come out at the
 * same depth. The tilt that falls out of it is printed and held by a test.
 *
 * `cut` is where albedo stops being geometry. A soot wash two metres across is
 * a stain; a board mark ten centimetres across is a ridge. Everything longer
 * than `cut` is subtracted off the height field before the gradient is taken,
 * which is what stops a bright corner of a photograph becoming a hill.
 *
 * Roughness is authored, not derived: `base` is what the material measures at,
 * and the picture only moves it about within `min` to `max`. What moves it is
 * grime (darker than the mean is dirtier, so rougher) and cavity (a hollow
 * collects dirt and was never polished); `grime` is the share of the swing the
 * first of those carries.
 */

/** @typedef {{ relief: number, cut: number, rough: { base: number, min: number, max: number }, grime: number, ao: number, metal?: number }} Surface */

/** @type {Record<string, Surface>} */
export const SURFACES = {
  // a moulded plastic panel is smooth on purpose: the relief is the flex crease
  // and the moulding line, and nothing else
  'plastic-panel': { relief: 0.5, cut: 0.2, rough: { base: 0.42, min: 0.3, max: 0.56 }, grime: 0.6, ao: 0.2 },
  // board-formed concrete on an interior wall: timber board ridging, form-tie
  // dimples, air pockets. Clean, so the grime term is small
  'formed-concrete': { relief: 2.5, cut: 0.25, rough: { base: 0.8, min: 0.68, max: 0.92 }, grime: 0.35, ao: 0.45 },
  // polished poured concrete underfoot: grinder swirl and exposed aggregate,
  // nearly flat, and the gloss is the point
  'polished-concrete': { relief: 0.3, cut: 0.4, rough: { base: 0.3, min: 0.18, max: 0.52 }, grime: 0.7, ao: 0.25 },
  // composite rainscreen cladding: flat panels, so the relief is the reveal and
  // the joint between one panel and the next
  cladding: { relief: 3, cut: 0.3, rough: { base: 0.62, min: 0.48, max: 0.8 }, grime: 0.55, ao: 0.4 },
  // weathering steel sheet: an oxide grain over a flat sheet. Rust is rough and
  // the run down the face is rougher still
  steel: { relief: 0.8, cut: 0.3, rough: { base: 0.78, min: 0.62, max: 0.94 }, grime: 0.7, ao: 0.4 },
  // board-marked precast concrete: the deepest relief in the set, because the
  // timber boards are pressed into the face
  precast: { relief: 4, cut: 0.25, rough: { base: 0.86, min: 0.74, max: 0.96 }, grime: 0.4, ao: 0.5 },
  // glazed ceramic tile: the tile is glass-smooth and the grout between is not,
  // which is the widest roughness swing here and the whole look of the surface
  tile: { relief: 2, cut: 0.3, rough: { base: 0.36, min: 0.18, max: 0.86 }, grime: 0.3, ao: 0.6 },
  // the kit's own asphalt: chippings and the polish the tyres leave on them
  asphalt: { relief: 6, cut: 0.5, rough: { base: 0.92, min: 0.8, max: 1 }, grime: 0.5, ao: 0.45 },
  // the kit's marble slabs, tinted grey into a pavement: the joints between the
  // flags are the relief, and they hold the dirt
  paving: { relief: 5, cut: 0.3, rough: { base: 0.88, min: 0.74, max: 0.98 }, grime: 0.45, ao: 0.55 },
  // bare earth: clods and stones, the roughest thing in the city
  earth: { relief: 15, cut: 0.5, rough: { base: 0.97, min: 0.9, max: 1 }, grime: 0.3, ao: 0.4 },
}

export const SURFACE_NAMES = Object.keys(SURFACES)
