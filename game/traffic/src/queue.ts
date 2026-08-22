import type { Car } from './car.ts'
import type { Lane, Link, Track } from './track.ts'

/** Put a car on a track, keeping the list ordered with the furthest along first. */
export function join(track: Lane | Link, car: Car): void {
  const at = track.cars.findIndex((other) => other.s < car.s)
  if (at === -1) track.cars.push(car)
  else track.cars.splice(at, 0, car)
  car.track = track
}

export function leave(track: Track, car: Car): void {
  const at = track.cars.indexOf(car)
  if (at !== -1) track.cars.splice(at, 1)
}

/** The car directly in front on the same track, if there is one. */
export function ahead(car: Car): Car | undefined {
  const at = car.track.cars.indexOf(car)
  return at > 0 ? car.track.cars[at - 1] : undefined
}
