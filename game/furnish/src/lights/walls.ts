/**
 * What the walls of a room burn.
 *
 * The wall vocabulary is where nearly all of a room's light is: the lit channel
 * under the rail runs the length of every clear stretch of every wall and is
 * the room's ceiling light, and the strips, niches, booths and panes standing
 * in the bays are its fittings. Each one is published where it is drawn, in the
 * interior's own metres, so a light stands in the fixture rather than near it.
 *
 * A bay is drawn in its own frame (x across, y up, z out of the wall) and put
 * on the wall by a matrix. There is no matrix here: a fixture is a point, so
 * which wall it is on is two numbers off `OUT`.
 */
import type { LightEmitter } from '@gb/scene'
import type { Palette } from '../style/palette.ts'
import { WALL, type BayKind } from '../walls/bays.ts'
import type { PlannedRun } from '../walls/plan.ts'
import type { Side, Span, WallRun } from '../walls/runs.ts'
import { COVE_SPAN, FIXTURE, fixtureAt, lensOf, washed } from './fixtures.ts'

/** Which way the room is, from the face of each wall: the bay frame's own +z. */
const OUT: Record<Side, { x: number; z: number }> = {
  north: { x: 0, z: 1 },
  south: { x: 0, z: -1 },
  west: { x: 1, z: 0 },
  east: { x: -1, z: 0 },
}

/** How high the channel under the rail burns, and how far off the wall its light stands. */
const COVE = { y: WALL.rail.under - 0.03, out: 0.12 }

interface Fitting {
  /** The middle of the lit part of the bay, off the floor. */
  readonly y: number
  /**
   * How far into the room the light stands. Not where the lens is: a channel is
   * 3 cm off the wall and a light put there lays a hot line along the skirting
   * under it, so a fixture stands about a hand further in, where the wash reads
   * as a gradient.
   */
  readonly out: number
  readonly candela: number
  /** Which of the palette's lit inks it burns in. */
  readonly lens: 'glow' | 'pane'
}

/** The bays that burn, and what each throws. Every other kind is unlit geometry. */
const FITTINGS: Partial<Record<BayKind, Fitting>> = {
  strip: { y: (WALL.strip.low + WALL.strip.high) / 2, out: 0.12, candela: FIXTURE.strip, lens: 'glow' },
  niche: { y: WALL.niche.head - 0.08, out: WALL.niche.depth + 0.04, candela: FIXTURE.niche, lens: 'glow' },
  booth: { y: WALL.booth.rack.low, out: WALL.booth.depth + 0.04, candela: FIXTURE.booth, lens: 'glow' },
  window: { y: (WALL.window.low + WALL.window.high) / 2, out: 0.1, candela: FIXTURE.window, lens: 'pane' },
}

/** Every fixture on every wall of one interior, in interior metres. */
export function wallFixtures(planned: readonly PlannedRun[], palette: Palette): LightEmitter[] {
  const ink = { glow: washed(lensOf(palette.glow)), pane: washed(lensOf(palette.pane)) }
  const fixtures: LightEmitter[] = []

  for (const { run, bays, bands } of planned) {
    for (const band of bands) {
      // one light stands for at most `COVE_SPAN` metres of channel and carries
      // the candela of the stretch it stands for, so a ten metre run reads as a
      // line rather than as one hot spot in the middle of the wall
      const spans = Math.max(1, Math.ceil((band.to - band.from) / COVE_SPAN))
      const span = (band.to - band.from) / spans
      for (let at = 0; at < spans; at++) {
        const along = band.from + (at + 0.5) * span
        fixtures.push(fixtureAt('cove', pointOn(run, along, COVE.y, COVE.out), ink.glow, FIXTURE.cove * span))
      }
    }

    for (const bay of bays) {
      const fitting = FITTINGS[bay.kind]
      if (!fitting) continue
      fixtures.push(fixtureAt(bay.kind, pointOn(run, middleOf(bay), fitting.y, fitting.out), ink[fitting.lens], fitting.candela))
    }
  }
  return fixtures
}

function middleOf(span: Span): number {
  return (span.from + span.to) / 2
}

/** A point `along` a run, `y` off the floor and `out` into the room from the face of the wall. */
function pointOn(run: WallRun, along: number, y: number, out: number): [number, number, number] {
  const across = run.side === 'north' || run.side === 'south'
  const off = OUT[run.side]
  return across ? [along, y, run.face + off.z * out] : [run.face + off.x * out, y, along]
}
