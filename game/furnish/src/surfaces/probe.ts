import * as THREE from 'three'
import { screenAverage } from '../screens/light.ts'
import { PALETTES, type FurnishStyle } from '../style/palette.ts'
import { SURFACE_LOOKS, type SurfacePart } from './surfaces.ts'

/**
 * What a room indoors has to reflect, and what a surface in it is lit by.
 *
 * `scene.environment` after dark is the prefiltered night sky, which is nearly
 * black, and the only light actually in a room is the lit channel under the
 * wall rail and the strips up the bays: emissive geometry no probe has ever
 * seen. So a glossy floor reflected nothing and read as a dark hole.
 *
 * This is the same answer `@gb/scene` gave the wet street: a small
 * equirectangular picture painted from what is really in the room, structured
 * up and down where it has to be right and only loosely round the compass where
 * nobody can tell. A floor only ever reflects rays above the horizon, so the
 * band that matters is the lit channel at the top of the wall, and that is what
 * is drawn brightest.
 *
 * The rest of the picture is the room's own surfaces, lit. The light goes in
 * first; then the floor is painted as its colour times what that light lays on
 * an upward face, the wall as its colour times what the light and the floor lay
 * on a sideways one, and the ceiling last, lit by all three. So a ceiling
 * looking straight down samples a lit floor, and nothing here is a hand-set
 * bounce: change the light and every surface follows.
 *
 * A screen is in the picture too. A television is on a wall at eye height, not
 * up in the cove, so it lands as one low lobe just over the horizon, in the
 * colour the screens really average over a whole schedule.
 *
 * One per interior language, 64 by 32, painted from the average of that
 * language's own pools and the colour its strips emit. Two pictures for a town
 * of any size, and they are what makes it safe for a floor to be polished.
 */

const WIDE = 64
const TALL = 32

/**
 * Where the lit channel sits in the picture, in degrees off the horizon: where
 * the rail at 2.4 m lands seen from a floor two to six metres away, which is
 * the reflection a room's floor actually carries.
 */
const CHANNEL = { from: 12, to: 26 }
/** Where the floor takes over from the wall. */
const GROUND = -15
/** How many light strips a wall is taken to carry, round the compass. */
const STRIPS = 4
/** How wide one of them reads, in degrees of azimuth. */
const STRIP_WIDE = 16
/**
 * Where a screen lands in the picture, in degrees off the horizon.
 *
 * Not where the set hangs: where a floor two to four metres away sees it, which
 * is the only part of it a polished floor can give back. A screen at chest
 * height is 30 degrees up from a metre away and 10 from four, so the band is
 * the one that reaches the floor and the part of it below the horizon is left
 * out, because no upward facing surface reflects that.
 */
const SCREEN = { from: 6, to: 22 }
/**
 * How wide one screen reads, in degrees of azimuth: a metre of glass seen from
 * two metres away. One wall carries it, not four.
 */
const SCREEN_WIDE = 26

/**
 * How hard the channel and the strips read.
 *
 * These are the calibration and there is no second dial: a floor sees the
 * channel at a grazing angle, where a dielectric reflects most of what hits it,
 * so a channel much over 1 washes the whole floor white instead of laying a
 * band of light across it. And the band is narrow for the same reason: 14
 * degrees of picture is a wide streak once it is reflected off the floor.
 */
const CHANNEL_LIGHT = 0.32
const STRIP_LIGHT = 0.18
/**
 * The third is not a dial at all. The screen goes into the picture at the
 * radiance it really emits, over the solid angle it really covers, so there is
 * nothing here to tune: raise it and the room is lit by a television brighter
 * than televisions are.
 *
 * What that comes to is small, and it is meant to be. Two square metres of cove
 * at 3.2 against half a square metre of glass at a quarter is fifty to one, so
 * a screen is about a fiftieth of a room's light and lifts a floor by about a
 * hundredth of a stop. What it does show is the reflection: a patch of the
 * colour that is on at that moment, in a floor polished enough to give it back.
 * A pool of light on the floor in front of the set would need a light object,
 * and there is none in this box.
 */
const SCREEN_LIGHT = 1

type Rgb = [number, number, number]

const UP: Rgb = [0, 1, 0]
const DOWN: Rgb = [0, -1, 0]
const SIDE: Rgb = [1, 0, 0]

/**
 * The room's own light and surfaces, as an equirectangular texture ready to be
 * prefiltered. Rows run from straight down to straight up, which is the
 * convention `THREE.EquirectangularReflectionMapping` samples by.
 */
export function roomProbe(style: FurnishStyle): THREE.DataTexture {
  const palette = PALETTES[style]
  const glow = scale(linear(palette.glow.glow ?? 0xffffff), palette.glow.glowStrength ?? 1)
  const average = screenAverage()
  const picture = new Picture()

  picture.paint((elevation, azimuth) => lights(elevation, azimuth, glow, [average[0], average[1], average[2]]))
  // the surfaces, each lit by everything painted before it
  const floor = scale(poolColour(style, 'floor'), picture.irradiance(UP))
  picture.paint((elevation) => (elevation < GROUND ? floor : undefined))
  const wall = scale(poolColour(style, 'wall'), picture.irradiance(SIDE))
  picture.paint((elevation) => (elevation >= GROUND && elevation < CHANNEL.from ? wall : undefined))
  const ceiling = scale(poolColour(style, 'ceiling'), picture.irradiance(DOWN))
  picture.paint((elevation) => (elevation >= CHANNEL.from ? ceiling : undefined))

  const texture = new THREE.DataTexture(picture.halfFloats(), WIDE, TALL, THREE.RGBAFormat, THREE.HalfFloatType)
  texture.name = `furnish:probe:${style}`
  texture.mapping = THREE.EquirectangularReflectionMapping
  texture.colorSpace = THREE.NoColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

/** The picture under construction: linear rgb per texel, added to layer by layer. */
class Picture {
  readonly #rgb = new Float32Array(WIDE * TALL * 3)

  /** Adds one layer: what `at` gives for a direction, or nothing to leave the texel alone. */
  paint(at: (elevation: number, azimuth: number) => Rgb | undefined): void {
    for (let row = 0; row < TALL; row++) {
      for (let column = 0; column < WIDE; column++) {
        const rgb = at(elevationOf(row), azimuthOf(column))
        if (!rgb) continue
        const index = (row * WIDE + column) * 3
        this.#rgb[index] = this.#rgb[index]! + rgb[0]
        this.#rgb[index + 1] = this.#rgb[index + 1]! + rgb[1]
        this.#rgb[index + 2] = this.#rgb[index + 2]! + rgb[2]
      }
    }
  }

  /**
   * What a matte surface facing `normal` is lit by, so far: the cosine-weighted
   * average of the picture over its hemisphere, scaled so a picture that is 1
   * everywhere lights every surface by 1, which is how the renderer reads it.
   */
  irradiance(normal: Rgb): number {
    let lit = 0
    let sphere = 0
    for (let row = 0; row < TALL; row++) {
      const elevation = (elevationOf(row) * Math.PI) / 180
      const solid = Math.cos(elevation)
      for (let column = 0; column < WIDE; column++) {
        const azimuth = (azimuthOf(column) * Math.PI) / 180
        const cosine =
          Math.cos(elevation) * Math.cos(azimuth) * normal[0] +
          Math.sin(elevation) * normal[1] +
          Math.cos(elevation) * Math.sin(azimuth) * normal[2]
        const index = (row * WIDE + column) * 3
        const value = (this.#rgb[index]! + this.#rgb[index + 1]! + this.#rgb[index + 2]!) / 3
        lit += value * Math.max(0, cosine) * solid
        sphere += solid
      }
    }
    return (lit / sphere) * 4
  }

  halfFloats(): Uint16Array {
    const data = new Uint16Array(WIDE * TALL * 4)
    for (let texel = 0; texel < WIDE * TALL; texel++) {
      for (let channel = 0; channel < 3; channel++) {
        data[texel * 4 + channel] = THREE.DataUtils.toHalfFloat(this.#rgb[texel * 3 + channel]!)
      }
      data[texel * 4 + 3] = THREE.DataUtils.toHalfFloat(1)
    }
    return data
  }
}

/** v runs linearly in elevation, which is how three samples an equirect. */
function elevationOf(row: number): number {
  return ((row + 0.5) / TALL - 0.5) * 180
}

function azimuthOf(column: number): number {
  return ((column + 0.5) / WIDE) * 360
}

/** The light in the room: the channel, the strips standing up the wall, and the screen. */
function lights(elevation: number, azimuth: number, glow: Rgb, screen: Rgb): Rgb {
  const set = scale(screen, SCREEN_LIGHT * lobe(elevation, azimuth))
  if (elevation >= CHANNEL.from && elevation <= CHANNEL.to) {
    // the lit channel, brightest in the middle of the band and falling off at
    // both edges, which is what a cove throwing light up a wall looks like
    const across = (elevation - CHANNEL.from) / (CHANNEL.to - CHANNEL.from)
    return add(scale(glow, CHANNEL_LIGHT * Math.sin(Math.PI * across)), set)
  }
  if (elevation < GROUND || elevation > CHANNEL.to) return set

  // the field of the wall, with the strips standing up it
  const period = 360 / STRIPS
  const nearest = Math.abs((((azimuth % period) + period) % period) - period / 2)
  const strip = Math.max(0, 1 - nearest / (STRIP_WIDE / 2))
  return add(scale(glow, STRIP_LIGHT * strip * strip), set)
}

/**
 * How hard a screen reads at a point of the picture: a soft patch of wall on
 * one side of the room, falling off at both edges the way the channel does.
 */
function lobe(elevation: number, azimuth: number): number {
  if (elevation < SCREEN.from || elevation > SCREEN.to) return 0
  const off = Math.abs(azimuth - 180)
  if (off > SCREEN_WIDE / 2) return 0
  const up = Math.sin((Math.PI * (elevation - SCREEN.from)) / (SCREEN.to - SCREEN.from))
  return up * Math.cos((Math.PI * off) / SCREEN_WIDE)
}

/** The colour a language's pool for one part averages to: the probe is shared by every room in it. */
function poolColour(style: FurnishStyle, part: SurfacePart): Rgb {
  const pool = SURFACE_LOOKS[style][part]
  const total = pool.map((look) => linear(look.colour)).reduce(add, [0, 0, 0])
  return scale(total, 1 / pool.length)
}

function linear(hex: number): Rgb {
  const colour = new THREE.Color().setHex(hex, THREE.SRGBColorSpace)
  return [colour.r, colour.g, colour.b]
}

function scale(rgb: Rgb, by: number): Rgb {
  return [rgb[0] * by, rgb[1] * by, rgb[2] * by]
}

function add(one: Rgb, two: Rgb): Rgb {
  return [one[0] + two[0], one[1] + two[1], one[2] + two[2]]
}
