import { FURNITURE_PROPS, ITEM_ARCHETYPES } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  CYCLE,
  FURNISH_STYLES,
  ITEM_CASTS,
  SCREEN_ATTRIBUTE,
  SCREEN_SLOTS,
  SURFACE_TEXTURE_IDS,
  STATIONS,
  SurfaceLibrary,
  furnishKit,
  pictureAt,
  screenAverage,
  screeningOf,
} from '../src/index.ts'

/**
 * A screen that plays something, and the two things that can quietly go wrong
 * with it.
 *
 * One is the batch. Every buffer in this box draws on one material and a
 * `BatchedMesh` takes them only while they agree attribute for attribute, so a
 * fifth attribute that reaches the television and not the chair beside it costs
 * a room its draws without changing a pixel. The other is the light: the room's
 * probe now carries what a screen emits, and the last test here is the one that
 * catches a screen being turned into a second cove.
 */

const kit = furnishKit()

/** What the glass attribute says at one vertex: where on the picture, and what is on. */
function glassAt(geometry: THREE.BufferGeometry, at: number) {
  const screen = geometry.getAttribute(SCREEN_ATTRIBUTE)
  return {
    u: screen.getX(at),
    v: screen.getY(at),
    station: Math.round(screen.getZ(at) * 255),
    phase: screen.getW(at),
  }
}

/** Every vertex of a geometry that is on a screen. */
function glass(geometry: THREE.BufferGeometry) {
  const found: ReturnType<typeof glassAt>[] = []
  for (let at = 0; at < geometry.getAttribute('position').count; at++) {
    const vertex = glassAt(geometry, at)
    if (vertex.station > 0) found.push(vertex)
  }
  return found
}

describe('the glass attribute', () => {
  it('is on every buffer in the box, so one of them cannot fall out of the batch', () => {
    const buffers: THREE.BufferGeometry[] = []
    for (const style of FURNISH_STYLES) {
      for (const prop of FURNITURE_PROPS) buffers.push(kit.geometry(prop, style))
    }
    for (const archetype of ITEM_ARCHETYPES) {
      for (let cast = 0; cast < ITEM_CASTS; cast++) buffers.push(kit.itemGeometry(archetype, cast))
    }

    for (const geometry of buffers) {
      const screen = geometry.getAttribute(SCREEN_ATTRIBUTE)
      expect(screen, geometry.name).toBeDefined()
      expect(screen.array, geometry.name).toBeInstanceOf(Uint8Array)
      expect(screen.itemSize, geometry.name).toBe(4)
      expect(screen.normalized, geometry.name).toBe(true)
      expect(screen.count, geometry.name).toBe(geometry.getAttribute('position').count)
    }
  })

  it('marks the television and nothing else, over the whole picture', () => {
    for (const style of FURNISH_STYLES) {
      const lit = FURNITURE_PROPS.filter((prop) => glass(kit.geometry(prop, style)).length > 0)
      expect(lit, style).toEqual(['tv'])

      const corners = glass(kit.geometry('tv', style))
      expect(Math.min(...corners.map((vertex) => vertex.u)), style).toBeLessThan(0.02)
      expect(Math.max(...corners.map((vertex) => vertex.u)), style).toBeGreaterThan(0.98)
      expect(Math.min(...corners.map((vertex) => vertex.v)), style).toBeLessThan(0.02)
      expect(Math.max(...corners.map((vertex) => vertex.v)), style).toBeGreaterThan(0.98)
    }
  })
})

describe('what a screen is tuned to', () => {
  it('costs a fixed handful of buffers, however many televisions a town has', () => {
    for (const style of FURNISH_STYLES) {
      expect(kit.screenings('tv', style), style).toBe(SCREEN_SLOTS)
      expect(kit.screenings('chair', style), style).toBe(1)
      // two rooms on the same screening draw the same buffer, not a copy of it
      expect(kit.geometry('tv', style, 2)).toBe(kit.geometry('tv', style, 2))
      expect(kit.geometry('tv', style, 2)).not.toBe(kit.geometry('tv', style, 3))
    }
  })

  it('is a real station and a phase, and the same one on the second visit', () => {
    for (let slot = 0; slot < SCREEN_SLOTS; slot++) {
      const screening = screeningOf('a-town', slot)
      expect(screening.station).toBeGreaterThanOrEqual(1)
      expect(screening.station).toBeLessThanOrEqual(STATIONS)
      expect(screening.phase).toBeGreaterThanOrEqual(0)
      expect(screening.phase).toBeLessThan(1)
      expect(screeningOf('a-town', slot)).toEqual(screening)
    }
    expect(screeningOf('a-town', 0)).not.toEqual(screeningOf('another-town', 0))
  })

  it('builds the same bytes from the same seed and different bytes from another', () => {
    const same = furnishKit('furnish').geometry('tv', 'corpo', 1).getAttribute(SCREEN_ATTRIBUTE).array
    const first = furnishKit('furnish').geometry('tv', 'corpo', 1).getAttribute(SCREEN_ATTRIBUTE).array
    const other = furnishKit('elsewhere').geometry('tv', 'corpo', 1).getAttribute(SCREEN_ATTRIBUTE).array

    expect([...same]).toEqual([...first])
    expect([...same]).not.toEqual([...other])
  })
})

describe('what is on the glass', () => {
  /** How bright the whole picture is at one second, in luminance. */
  function brightness(station: number, seconds: number): number {
    let sum = 0
    for (let down = 0; down < 9; down++) {
      for (let along = 0; along < 16; along++) {
        const [red, green, blue] = pictureAt((along + 0.5) / 16, (down + 0.5) / 9, station, 0, seconds)
        sum += 0.2126 * red + 0.7152 * green + 0.0722 * blue
      }
    }
    return sum / 144
  }

  it('changes through the schedule rather than holding one picture', () => {
    const through = Array.from({ length: 24 }, (_, at) => brightness(1, at * 11 + 3))
    const spread = Math.max(...through) - Math.min(...through)

    expect(spread).toBeGreaterThan(0.1)
    expect(through.every((value) => value > 0.01)).toBe(true)
  })

  it('is not the same thing on every set at the same second', () => {
    const seconds = 57
    const shown = new Set(
      Array.from({ length: STATIONS }, (_, at) => brightness(at + 1, seconds).toFixed(3)),
    )
    expect(shown.size).toBeGreaterThan(1)
  })

  it('shows the same second twice the same, which is what makes a town replayable', () => {
    for (const seconds of [0.5, 37, 118.25]) {
      expect(pictureAt(0.31, 0.62, 3, 0.4, seconds)).toEqual(pictureAt(0.31, 0.62, 3, 0.4, seconds))
      // and the schedule comes round, so nothing here reads a clock that only goes up
      expect(pictureAt(0.31, 0.62, 3, 0.4, seconds + CYCLE)).toEqual(pictureAt(0.31, 0.62, 3, 0.4, seconds))
    }
  })

  it('stays inside the band the bloom was tuned for', () => {
    let peak = 0
    let total = 0
    let count = 0
    for (let station = 1; station <= STATIONS; station++) {
      for (let moment = 0; moment < 40; moment++) {
        for (let down = 0; down < 9; down++) {
          for (let along = 0; along < 16; along++) {
            const rgb = pictureAt((along + 0.5) / 16, (down + 0.5) / 9, station, 0, (moment * CYCLE) / 40 + 3)
            const lit = Math.max(...rgb)
            peak = Math.max(peak, lit)
            total += lit
            count++
          }
        }
      }
    }
    // over 1 so the app's bloom finds it, under a light strip's 3.2 so it is a
    // television and not a lamp, and dark on average because a screen mostly is
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThan(3.2)
    expect(total / count).toBeLessThan(0.5)
  })
})

describe('what a screen puts into the room', () => {
  const surfaces = new SurfaceLibrary(
    new Map(SURFACE_TEXTURE_IDS.map((id) => [id, { map: new THREE.Texture(), normal: undefined }])),
  )

  /** One pixel of a probe, in luminance. Rows run from straight down to straight up. */
  function probeAt(texture: THREE.DataTexture, row: number, column: number): number {
    const data = texture.image.data as Uint16Array
    const at = (row * 64 + column) * 4
    return (
      0.2126 * THREE.DataUtils.fromHalfFloat(data[at]!) +
      0.7152 * THREE.DataUtils.fromHalfFloat(data[at + 1]!) +
      0.0722 * THREE.DataUtils.fromHalfFloat(data[at + 2]!)
    )
  }

  it('is measured off the picture, not written down', () => {
    // if this drifts far from neutral the probe is tinting every room in the
    // town the colour of whatever happens to be on
    const average = screenAverage()
    expect(Math.min(...average)).toBeGreaterThan(0.05)
    expect(Math.max(...average)).toBeLessThan(0.5)
    expect(Math.max(...average) / Math.min(...average)).toBeLessThan(1.6)
  })

  it('is one wall of the room the floor reflects, and only one', () => {
    for (const style of FURNISH_STYLES) {
      const probe = surfaces.probe(style)
      // row 17 is eight degrees up: the screen is there, the lit channel is not
      const towards = probeAt(probe, 17, 32)
      const away = probeAt(probe, 17, 0)

      expect(towards, style).toBeGreaterThan(2 * away)
      // and it is well under the lit channel over it, which is the room's real light
      expect(towards, style).toBeLessThan(0.5 * probeAt(probe, 19, 32))
    }
  })
})
