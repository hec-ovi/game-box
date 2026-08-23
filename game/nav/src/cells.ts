/** A cell on the city grid. */
export interface Cell {
  readonly x: number
  readonly y: number
}

/** A spot on the ground in metres, the way the scene wants it. */
export interface Point {
  readonly x: number
  readonly z: number
}
