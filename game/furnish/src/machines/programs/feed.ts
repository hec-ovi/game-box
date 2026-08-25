import * as THREE from 'three'
import { LIT } from '../../style/lit.ts'
import { marginOf, print, PROUD, type Page, type Program } from './page.ts'

/**
 * A camera feed, drawn as the schematic of the room it watches: the walls as a
 * bright outline, everything standing in the room as a dim box turned the way
 * it stands, the camera as a red dot, and a recording mark with a clock over
 * it. A screen whose interior hangs no camera shows no signal.
 */
const LINE = 0.005

export const feed: Program = (page) => {
  const { width, height, watched } = page
  const margin = marginOf(page)
  print(page, { x: -width / 2 + margin + 0.006, y0: height * 0.88, y1: height * 0.88 + 0.012, width: 0.012, look: LIT.red })
  print(page, { x: width / 2 - margin - width * 0.13, y0: height * 0.875, y1: height * 0.905, width: width * 0.26, look: LIT.faint })

  if (!watched) {
    print(page, { x: 0, y0: height * 0.42, y1: height * 0.48, width: width * 0.36, look: LIT.faint })
    return
  }

  const field = { w: width - 2 * margin, h: height * 0.82 - 2 * margin }
  const scale = Math.min(field.w / watched.rect.w, field.h / watched.rect.h)
  const plan = { w: watched.rect.w * scale, h: watched.rect.h * scale }
  const centre = { x: watched.rect.x + watched.rect.w / 2, y: watched.rect.y + watched.rect.h / 2 }
  const base = margin + field.h / 2
  // the prop's +x is the reader's left, so east is mirrored back to the reader's right
  const across = (x: number): number => -(x - centre.x) * scale
  const up = (y: number): number => base + (centre.y - y) * scale

  for (const [x, w, low, high] of [
    [0, plan.w, base - plan.h / 2, base - plan.h / 2 + LINE],
    [0, plan.w, base + plan.h / 2 - LINE, base + plan.h / 2],
    [-plan.w / 2 + LINE / 2, LINE, base - plan.h / 2 + LINE, base + plan.h / 2 - LINE],
    [plan.w / 2 - LINE / 2, LINE, base - plan.h / 2 + LINE, base + plan.h / 2 - LINE],
  ] as const) {
    print(page, { x, y0: low, y1: high, width: w, look: LIT.green })
  }

  for (const piece of watched.pieces) {
    const w = Math.max(0.004, piece.width * scale - 0.003)
    const d = Math.max(0.004, piece.depth * scale - 0.003)
    if (!inside(plan, across(piece.x), up(piece.y) - base, w, d, piece.rot)) continue
    turned(page, across(piece.x), up(piece.y), piece.rot, () => {
      page.solid.block({ z: -PROUD / 2, width: w, depth: PROUD, y0: -d / 2, y1: d / 2, look: LIT.moss })
    })
  }
  print(page, {
    x: across(watched.camera.x),
    y0: up(watched.camera.y) - 0.006,
    y1: up(watched.camera.y) + 0.006,
    width: 0.012,
    look: LIT.red,
  })
}

/** Draws in a frame turned about the reader's line of sight, so a box stands the way its piece does. */
function turned(page: Page, x: number, y: number, rot: number, body: () => void): void {
  const frame = new THREE.Matrix4()
    .makeTranslation(x, y, 0)
    .multiply(new THREE.Matrix4().makeRotationZ((rot * Math.PI) / 180))
  page.solid.in(frame, body)
}

/** Whether a turned box stays inside the outline, so nothing prints over the walls. */
function inside(plan: { w: number; h: number }, x: number, y: number, w: number, d: number, rot: number): boolean {
  const turn = (rot * Math.PI) / 180
  const halfX = (w / 2) * Math.abs(Math.cos(turn)) + (d / 2) * Math.abs(Math.sin(turn))
  const halfY = (w / 2) * Math.abs(Math.sin(turn)) + (d / 2) * Math.abs(Math.cos(turn))
  return Math.abs(x) + halfX <= plan.w / 2 - LINE - 0.002 && Math.abs(y) + halfY <= plan.h / 2 - LINE - 0.002
}
