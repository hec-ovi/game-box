/**
 * What the things standing in a room burn: the glass of every machine in it,
 * and the lit floor under its dancers.
 *
 * Both are drawn into the room's own geometry rather than into a shared piece,
 * so both are published here in the interior's own metres, beside the fixtures
 * the walls carry.
 */
import { PROP_SPECS, type Interior } from '@gb/world'
import type { LightEmitter } from '@gb/scene'
import * as THREE from 'three'
import { DANCE, type LitTile } from '../dance/floor.ts'
import { PANELS, glassFrame, glassOf, isMachine } from '../machines/panel.ts'
import { pieceFrame } from '../machines/print.ts'
import { screenAverage } from '../screens/light.ts'
import { LIT_TILES } from '../style/lit.ts'
import { FIXTURE, fixtureAt, lensOf, washed } from './fixtures.ts'

/** How far in front of the glass its light stands, so the bezel round it is lit too. */
const OFF_GLASS = 0.08

/** How high over the tiles a dance floor's light stands: knee height, so it lights the dancers from below. */
const OVER_TILES = 0.35

/** Every machine in the interior, lit at its glass, in the colour a screen really averages. */
export function screenFixtures(interior: Interior): LightEmitter[] {
  const colour = screenColour()
  const fixtures: LightEmitter[] = []
  const spot = new THREE.Vector3()

  for (const piece of interior.furniture) {
    if (!piece.machine || !isMachine(piece.prop)) continue
    const top = PROP_SPECS[piece.prop].height ?? 0
    const glass = glassOf(PANELS[piece.prop], top)
    const frame = pieceFrame(piece).multiply(glassFrame(piece.prop, top))
    spot.set(0, glass.height / 2, -OFF_GLASS).applyMatrix4(frame)
    fixtures.push(fixtureAt('screen', [spot.x, spot.y, spot.z], colour, FIXTURE.screen))
  }
  return fixtures
}

/**
 * One light over each room that dances, at the middle of its lit tiles and
 * carrying the candela of all of them. A tile is 46 cm across and a floor is
 * dozens of them; one light is what they add up to seen from standing height,
 * and the tiles themselves carry the four colours.
 */
export function danceFixtures(tiles: readonly LitTile[]): LightEmitter[] {
  const floors = new Map<string, { x: number; z: number; count: number }>()
  for (const tile of tiles) {
    const floor = floors.get(tile.roomId) ?? { x: 0, z: 0, count: 0 }
    floor.x += tile.x
    floor.z += tile.y
    floor.count++
    floors.set(tile.roomId, floor)
  }

  const colour = washed(tileMix())
  return [...floors.values()].map((floor) =>
    fixtureAt(
      'dance',
      [floor.x / floor.count, DANCE.thick + OVER_TILES, floor.z / floor.count],
      colour,
      FIXTURE.tile * floor.count,
    ),
  )
}

/**
 * The colour a screen throws: what the pictures really average over a whole
 * schedule, taken as a hue. How bright it is is the fixture's own candela, so
 * this is normalised to its own brightest channel.
 */
function screenColour(): number {
  const average = screenAverage()
  const peak = Math.max(average[0], average[1], average[2], 1e-6)
  return new THREE.Color()
    .setRGB(average[0] / peak, average[1] / peak, average[2] / peak, THREE.LinearSRGBColorSpace)
    .getHex(THREE.SRGBColorSpace)
}

/** The four tile colours as one: what a floor of them together throws. */
function tileMix(): number {
  let mixed = 0
  for (const shift of [16, 8, 0]) {
    const average = LIT_TILES.reduce((total, look) => total + ((lensOf(look) >> shift) & 0xff), 0) / LIT_TILES.length
    mixed |= Math.round(average) << shift
  }
  return mixed
}
