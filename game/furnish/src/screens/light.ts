import { pictureAt, type Rgb } from './picture.ts'
import { CYCLE, STATIONS } from './schedule.ts'

/**
 * What a screen puts into the room, measured rather than guessed.
 *
 * A screen is the only thing in here whose brightness changes minute to minute,
 * and the room's probe needs one number for it, so this reads the picture
 * itself: every station, over a whole schedule, over the whole of the glass.
 * Retune the picture and this number follows it, which is the only way the
 * light in the room can stay honest about what is on the screen.
 */

const ACROSS = 12
const UP = 8
/** Moments sampled through a station's schedule: one every five seconds. */
const MOMENTS = 48

let measured: Rgb | undefined

/** The average colour a screen emits, over the glass and over a whole schedule. */
export function screenAverage(): Rgb {
  if (measured) return measured

  let red = 0
  let green = 0
  let blue = 0
  let count = 0
  for (let station = 1; station <= STATIONS; station++) {
    for (let moment = 0; moment < MOMENTS; moment++) {
      const seconds = (moment * CYCLE) / MOMENTS
      for (let down = 0; down < UP; down++) {
        for (let along = 0; along < ACROSS; along++) {
          const rgb = pictureAt((along + 0.5) / ACROSS, (down + 0.5) / UP, station, 0, seconds)
          red += rgb[0]
          green += rgb[1]
          blue += rgb[2]
          count++
        }
      }
    }
  }

  measured = [red / count, green / count, blue / count]
  return measured
}
