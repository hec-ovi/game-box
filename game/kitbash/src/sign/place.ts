import type { Face } from '../compose/faces.ts'
import type { Patch, WallClaims } from './claims.ts'
import { outward, SIGN, type Mount, type Sign, type SignKind, type Written } from './sign.ts'

/** A sign described on its own wall, before the wall has said whether there is room. */
export interface Panel extends Patch {
  readonly kind: SignKind
  readonly mount: Mount
  readonly ink: number
  readonly panel: number
  readonly glow: readonly [number, number]
  readonly glyphs: readonly Written[]
}

/**
 * The first candidate its wall has room for, claimed and put in the building's
 * frame. A flat panel stands `SIGN.stand` off the wall plane and looks the way
 * the wall does; a hung one starts there and reaches out at a right angle.
 */
export function place(face: Face, candidates: readonly Panel[], claims: WallClaims): Sign | undefined {
  for (const panel of candidates) {
    if (claims.take(face.id, footprint(panel))) return onWall(face, panel)
  }
  return undefined
}

/** How wide the wall is. */
export function wallOf(face: Face): number {
  return face.modules * face.moduleWidth
}

/** Where the middle of a module sits along its wall. */
export function alongOf(face: Face, module: number): number {
  return (module + 0.5) * face.moduleWidth - wallOf(face) / 2
}

/** Keeps a panel of `width` inside the wall it is on. */
export function within(face: Face, along: number, width: number): number {
  const reach = Math.max(0, wallOf(face) / 2 - width / 2 - 0.12)
  return Math.max(-reach, Math.min(reach, along))
}

/** Keeps a panel of `tall` between the pavement and the parapet, or says it will not fit. */
export function between(up: number, tall: number, height: number): number | undefined {
  const lowest = 0.45 + tall / 2
  const highest = height - 0.1 - tall / 2
  return highest < lowest ? undefined : Math.max(lowest, Math.min(highest, up))
}

/** What a panel takes off the wall: a flat one its whole face, a hung one the width of its bracket. */
function footprint(panel: Panel): Patch {
  return panel.mount === 'flat' ? panel : { along: panel.along, up: panel.up, width: SIGN.foot, height: panel.height }
}

function onWall(face: Face, panel: Panel): Sign {
  const away = outward(face.right)
  const out = panel.mount === 'flat' ? SIGN.stand : SIGN.stand + panel.width / 2
  return {
    kind: panel.kind,
    wall: face.id,
    mount: panel.mount,
    origin: [face.origin[0] + face.right[0] * panel.along + away[0] * out, panel.up, face.origin[1] + face.right[1] * panel.along + away[1] * out],
    right: panel.mount === 'flat' ? face.right : away,
    width: panel.width,
    height: panel.height,
    ink: panel.ink,
    panel: panel.panel,
    glow: panel.glow,
    glyphs: panel.glyphs,
  }
}
