import { nightLook } from '@gb/kitbash'
import { describe, expect, it } from 'vitest'
import { PANE, paneAt } from '../src/glass.ts'
import { UNLIT, litShare, shownAt } from '../src/interior.ts'
import { SHOPFRONT } from '../src/windows.ts'

/**
 * What a player on the pavement can see through a shopfront. Both halves of it
 * are shader arithmetic, and both have a twin in plain numbers the shader runs
 * the same lines as, the way `boxedAt` is the twin of the window hash.
 *
 * The failure they cover: hold the room behind the glass to the night's own
 * occupancy reading at noon, when the city says 3% of it is lit, and the pane's
 * reflection of the sky is 95% of the pixel, so a shopfront is a grey sheet.
 * `node tools/measure-glass.ts` prints the split on the shipped pack.
 */

describe('the pane over a window', () => {
  it('lets nearly all of the room through face on and turns to sky along the street', () => {
    // face on a pane is 4% reflection, which is what glass is; the room behind
    // it keeps the rest, or there is no point drawing a room
    expect(paneAt(1).reflected).toBeCloseTo(PANE.reflectance, 6)
    expect(paneAt(1).through).toBeCloseTo(0.96, 6)

    // along the pavement it is mostly the street and the sky, which is what a
    // shop window does
    expect(paneAt(0.24).reflected).toBeGreaterThan(0.25)
    expect(paneAt(0.1).reflected).toBeGreaterThan(0.5)
  })

  it('is never a hole in the wall and never a mirror', () => {
    let last = 0
    for (const facing of [1, 0.75, 0.5, 0.25, 0.1, 0]) {
      const seen = paneAt(facing)
      expect(seen.reflected, `facing ${facing}`).toBeGreaterThanOrEqual(PANE.reflectance)
      expect(seen.reflected, `facing ${facing}`).toBeLessThanOrEqual(1)
      expect(seen.reflected + seen.through, `facing ${facing}`).toBeCloseTo(1, 6)
      // and it climbs the one way as the wall turns away, so no angle is a step
      expect(seen.reflected, `facing ${facing}`).toBeGreaterThanOrEqual(last)
      last = seen.reflected
    }
  })
})

describe('what a window shows of the room behind it', () => {
  it('shows the whole picture in daylight, whoever has their lights on', () => {
    // the city's lit share is a night reading: at noon it says 3% of the town,
    // which held nine shopfronts in ten at UNLIT and made the glass opaque
    const noon = nightLook(12)
    expect(noon.level).toBe(0)
    expect(litShare(noon.lit, SHOPFRONT.keys)).toBeLessThan(0.1)
    expect(shownAt(noon.level, false)).toBe(1)
    expect(shownAt(noon.level, true)).toBe(1)
  })

  it('holds a dark window back after dark, and only then', () => {
    const night = nightLook(21)
    expect(night.level).toBe(1)
    expect(shownAt(night.level, true)).toBe(1)
    expect(shownAt(night.level, false)).toBeCloseTo(UNLIT, 6)
    // and the evening walks between the two rather than switching
    expect(shownAt(nightLook(19).level, false)).toBeCloseTo((1 + UNLIT) / 2, 6)
  })
})
