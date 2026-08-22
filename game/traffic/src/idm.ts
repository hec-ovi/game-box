/**
 * Treiber's Intelligent Driver Model: one acceleration from the free road you
 * want and the gap you actually have. It is the reason a car eases off behind
 * another instead of arriving inside it.
 *
 * Reference: Treiber, Hennecke and Helbing, "Congested traffic states in
 * empirical observations and microscopic simulations" (2000).
 */

export interface Driving {
  /** Comfortable acceleration, m/s^2. */
  readonly accel: number
  /** Comfortable braking, m/s^2. Positive. */
  readonly brake: number
  /** Standstill gap kept to the car in front, metres. */
  readonly minGap: number
  /** Time headway to the car in front, seconds. */
  readonly headway: number
  /** How sharply the car gives up acceleration near its desired speed. */
  readonly exponent: number
  /** Hardest braking the model may ask for, m/s^2. Caps an emergency. */
  readonly maxBrake: number
}

/** City driving: modest acceleration, a gap you could stop in, no racing. */
export const CITY_DRIVING: Driving = {
  accel: 1.5,
  brake: 2,
  minGap: 2,
  headway: 1.2,
  exponent: 4,
  maxBrake: 8,
}

/**
 * `gap` is bumper to bumper in metres (Infinity on an open road), `closing` is
 * how much faster this car is going than the one in front.
 */
export function idmAcceleration(
  d: Driving,
  speed: number,
  desiredSpeed: number,
  gap: number,
  closing: number,
): number {
  const free = 1 - (speed / desiredSpeed) ** d.exponent
  if (!Number.isFinite(gap)) return clamp(d.accel * free, d)
  const wanted = d.minGap + Math.max(0, speed * d.headway + (speed * closing) / (2 * Math.sqrt(d.accel * d.brake)))
  const room = Math.max(gap, 0.1)
  return clamp(d.accel * (free - (wanted / room) ** 2), d)
}

function clamp(a: number, d: Driving): number {
  return Math.max(-d.maxBrake, Math.min(a, d.accel))
}
