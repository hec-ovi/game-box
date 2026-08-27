/**
 * Every per-window choice in the city, and the one hash behind all of them.
 *
 * A window's seed is where its bay sits along the wall, so the answers are a
 * pure function of the plot and the opening: the same street looks the same on
 * every machine, on every run, and a building batched into a shared buffer
 * keeps the windows it had. Nothing here reads a stream, so drawing one plot
 * cannot move another.
 *
 * Whether a window is lit at all is the bare seed; every other choice adds its
 * own salt first.
 *
 * The shader asks with `three/tsl`'s `hash`, which is the PCG hash from
 * pcg-random.org; `hashOf` is the same arithmetic in plain integers, so a tool
 * or a test can answer for a window without a GPU. Both sides read the salts
 * and the shares below, so there is one place where a choice is made.
 */

/** What each choice adds to the bay's seed before hashing, so no two of them agree. */
export const SALT = {
  /** Which back wall or which flat panel it shows. */
  picture: 977,
  /** Which colour it burns in. */
  tint: 3121,
  /** Whether its picture is read left to right or right to left. */
  mirror: 6151,
  /** Whether it marches a room box or shows a flat panel. */
  kind: 4001,
  /** Which of the two side walls is on which side of the room. */
  wall: 7919,
} as const

/**
 * How many windows keep the room box.
 *
 * The box is worth roughly five times the fragment work of a plain glazed
 * window, and a street where every opening is a fully drawn room gives the eye
 * nowhere to land. Street level keeps most of them, because that is where a
 * player stands a metre from the glass and can see in properly; above it most
 * windows are a curtain, a blind or a lit panel, which is what a real street
 * mostly shows anyway.
 */
export const BOXED = { street: 0.8, upper: 0.22 } as const

/**
 * What a bay's place on the wall is worth, and where the count starts so the
 * bay at the origin does not hash zero. Bay indices run on along the wall and
 * never repeat with the picture.
 */
export const BAY = { across: 1973, down: 9277, first: 1 } as const

/** The seed of the bay at this place on the wall. */
export function baySeed(across: number, down: number): number {
  return across * BAY.across + down * BAY.down + BAY.first
}

/**
 * `three/tsl`'s `hash`, in plain integers: a value in [0, 1) from a seed.
 *
 * Taken from pcg-random.org, the same three lines the shader runs. Kept beside
 * the salts rather than reimplemented at each caller, because the whole point
 * is that Node and the GPU answer the same thing.
 */
export function hashOf(seed: number): number {
  const state = (Math.imul(seed >>> 0, 747796405) + 2891336453) >>> 0
  const word = Math.imul(((state >>> ((state >>> 28) + 4)) ^ state) >>> 0, 277803737) >>> 0
  return (((word >>> 22) ^ word) >>> 0) / 2 ** 32
}

/** Whether the window at this bay marches a room box rather than showing a flat panel. */
export function boxedAt(across: number, down: number, street: boolean): boolean {
  return hashOf(baySeed(across, down) + SALT.kind) < (street ? BOXED.street : BOXED.upper)
}
