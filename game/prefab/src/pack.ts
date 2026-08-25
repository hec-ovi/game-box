/** What the committed pack is called and made of, shared by the builder and the loader. */

/** The vertex attribute that says which layer of the pack's atlas a face wears. */
export const LAYER_ATTRIBUTE = '_layer'

/** The name the one building material carries, and so the name of its batch in `@gb/scene`. */
export const MATERIAL_NAME = 'prefab:facade'

/** The name the glass every window wears carries, and so the name of the city's second batch. */
export const GLASS_MATERIAL_NAME = 'prefab:glass'

/** The name the far shell of every building carries: the walls alone, read from across the town. */
export const SHELL_MATERIAL_NAME = 'prefab:shell'

/**
 * How hard a lit face burns after dark: what the runtime multiplies the pack's
 * glow map by. The pack stores glow divided by this, so a neon tube and a lit
 * window fit one 8-bit map and the loudest thing in the city lands just under
 * clipping with a little over for the bloom pass to catch.
 */
export const GLOW = 2.6
