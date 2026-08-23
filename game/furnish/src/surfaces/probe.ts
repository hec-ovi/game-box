import * as THREE from 'three'
import { screenAverage } from '../screens/light.ts'
import { PALETTES, type FurnishStyle } from '../style/palette.ts'
import { lookOf } from './surfaces.ts'

/**
 * What a polished floor indoors has to reflect.
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
 * A screen is in the picture too. A television is on a wall at eye height, not
 * up in the cove, so it lands as one low lobe just over the horizon, in the
 * colour the screens really average over a whole schedule. It lifts a floor a
 * little and lays a soft patch across it, which is what a lit screen does to a
 * dark room; it is nowhere near the channel, because a screen is a fraction of
 * a metre of wall and the cove is all of it.
 *
 * One per interior language, 64 by 32, painted from that language's own
 * surfaces and the colour its strips emit. Two pictures for a town of any size,
 * and they are what makes it safe for a floor to be polished.
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

/** How much of each surface's own colour comes back. A room is not a mirror box. */
const BOUNCE = { floor: 0.08, wall: 0.12, ceiling: 0.05 }
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

/**
 * The room's own light and surfaces, as an equirectangular texture ready to be
 * prefiltered. Rows run from straight down to straight up, which is the
 * convention `THREE.EquirectangularReflectionMapping` samples by.
 */
export function roomProbe(style: FurnishStyle): THREE.DataTexture {
  const palette = PALETTES[style]
  const floor = linear(lookOf(style, 'floor', 0).colour)
  const wall = linear(lookOf(style, 'wall', 0).colour)
  const ceiling = linear(lookOf(style, 'ceiling', 0).colour)
  const glow = scale(linear(palette.glow.glow ?? 0xffffff), palette.glow.glowStrength ?? 1)
  const average = screenAverage()
  const screen: Rgb = [average[0], average[1], average[2]]

  const data = new Uint16Array(WIDE * TALL * 4)
  for (let row = 0; row < TALL; row++) {
    // v runs linearly in elevation, which is how three samples an equirect
    const elevation = ((row + 0.5) / TALL - 0.5) * 180
    for (let column = 0; column < WIDE; column++) {
      const azimuth = ((column + 0.5) / WIDE) * 360
      const rgb = paint(elevation, azimuth, { floor, wall, ceiling, glow, screen })
      const at = (row * WIDE + column) * 4
      data[at] = THREE.DataUtils.toHalfFloat(rgb[0])
      data[at + 1] = THREE.DataUtils.toHalfFloat(rgb[1])
      data[at + 2] = THREE.DataUtils.toHalfFloat(rgb[2])
      data[at + 3] = THREE.DataUtils.toHalfFloat(1)
    }
  }

  const texture = new THREE.DataTexture(data, WIDE, TALL, THREE.RGBAFormat, THREE.HalfFloatType)
  texture.name = `furnish:probe:${style}`
  texture.mapping = THREE.EquirectangularReflectionMapping
  texture.colorSpace = THREE.NoColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}

interface Room {
  readonly floor: Rgb
  readonly wall: Rgb
  readonly ceiling: Rgb
  readonly glow: Rgb
  /** What the screens in the room average over a whole schedule. */
  readonly screen: Rgb
}

function paint(elevation: number, azimuth: number, room: Room): Rgb {
  const screen = scale(room.screen, SCREEN_LIGHT * lobe(elevation, azimuth))
  return add(surfaces(elevation, azimuth, room), screen)
}

/** The room without its screen: the floor under, the ceiling over, the wall and its channel. */
function surfaces(elevation: number, azimuth: number, room: Room): Rgb {
  if (elevation < GROUND) return scale(room.floor, BOUNCE.floor)
  if (elevation > CHANNEL.to) return scale(room.ceiling, BOUNCE.ceiling)

  if (elevation >= CHANNEL.from) {
    // the lit channel, brightest in the middle of the band and falling off at
    // both edges, which is what a cove throwing light up a wall looks like
    const across = (elevation - CHANNEL.from) / (CHANNEL.to - CHANNEL.from)
    const fall = Math.sin(Math.PI * across)
    return add(scale(room.ceiling, BOUNCE.ceiling), scale(room.glow, CHANNEL_LIGHT * fall))
  }

  // the field of the wall, with the strips standing up it
  const period = 360 / STRIPS
  const nearest = Math.abs((((azimuth % period) + period) % period) - period / 2)
  const strip = Math.max(0, 1 - nearest / (STRIP_WIDE / 2))
  return add(scale(room.wall, BOUNCE.wall), scale(room.glow, STRIP_LIGHT * strip * strip))
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
