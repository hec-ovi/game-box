/**
 * The pieces of the shipped building kit, by the names its files carry. A
 * resolved charter names its walls from this list and nothing else, so a file
 * can never ask for a wall the kit does not hold.
 */
export const KIT_PIECES = [
  'Brick_BottomTrim',
  'Brick_Window_Trim',
  'Metal_FirstFloor_Wall',
  'Metal_FirstFloor_Window',
  'Trim_FirstFloor_Wall',
  'Trim_FirstFloor_Window_001',
  'Metal_FullWindow',
  'DoorFrame_Trim',
  'DoorFrame_Metal_Single',
  'Brick_Plain_1',
  'Metal_Plain_1',
  'Metal_FirstFloor_Wall_1',
  'Brick_Plain_3',
  'Brick_Window_Square_Single',
  'Brick_Window_Trim_Single',
  'Metal_Plain_3',
  'Metal_Window_Half',
  'Brick_TopTrim',
  'Roof_2x2',
] as const

export type KitPiece = (typeof KIT_PIECES)[number]
