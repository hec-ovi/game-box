/**
 * What a player on the pavement actually sees in a shopfront: how much of the
 * pixel is the room behind the glass, and how much is the pane over it.
 *
 *   node tools/measure-glass.ts [--stand 3] [--hours 12,19,21,0]
 *
 * The pack's own pictures and this box's own constants, run through the same
 * arithmetic the two shaders run: the bay grid (`src/bays.ts`), the room box
 * (`src/roombox.ts`), the flat panel (`src/panel.ts`), the tint and the lit
 * gate (`src/interior.ts`), how the wall composes them (`src/material.ts`) and
 * what the pane does over them (`src/glass.ts`). It marches every shopfront bay
 * of a real model at a real standing position and averages, so the split is the
 * one on screen and not a reading of the source.
 *
 * What lights the street is not this box's to decide, so it is quoted rather
 * than invented: the sun, the sky light and the dome's radiance are
 * `@gb/land`'s own hour table, and how much of the dome reaches a material is
 * `@gb/app`'s `Look.environment`. Both are named in `STREET_LIGHT` below.
 */
import { nightLook } from '@gb/kitbash'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import type * as THREE from 'three'
import type { Catalogue } from '../src/catalogue.ts'
import { PANE, STREET, paneAt } from '../src/glass.ts'
import { ROOM, litShare, shownAt } from '../src/interior.ts'
import { LAYER_ATTRIBUTE } from '../src/pack.ts'
import { PANEL } from '../src/panel.ts'
import { SALT, baySeed, boxedAt, hashOf } from '../src/pick.ts'
import { NEAR_DARK, SIDE_DARK } from '../src/roombox.ts'
import { ROOM_SIZE, ROOM_TINTS, type Bank, type GlazingStrip } from '../src/rooms.ts'
import { SHOPFRONT } from '../src/windows.ts'
import { flag } from './args.ts'
import { readPack } from './headless.ts'

const args = process.argv.slice(2)
const stand = Number(flag(args, '--stand') ?? 3)
const hours = (flag(args, '--hours') ?? '12,19,21,0').split(',').map(Number)

/** Eye height of the player standing on the pavement, in metres. */
const EYE = 1.65

/** How finely the opening is sampled, each way. */
const GRID = 48

/**
 * What is throwing light on the street at each hour, in the renderer's own
 * units. The sun, the sky light and the dome are `@gb/land`'s measured hour
 * table; `sky` is how much of the dome a material gives back, which is
 * `@gb/app`'s `Look.environment` (0.06 outdoors) times the dome's radiance at
 * the horizon, where a pane on a vertical wall reflects.
 */
const STREET_LIGHT: Record<number, { facade: number; sky: number }> = {
  // noon: sun 3.10 at 24 degrees onto a facade square to it, plus the 2.20 sky
  // light over half a hemisphere; the dome's horizon is (1.30, 1.79, 1.94)
  12: { facade: 3.1 * Math.cos((24 * Math.PI) / 180) + 2.2 * 0.5, sky: 1.72 * 0.06 },
  // after sunset the sun is gone and the sky light is 0.78, the dome 0.019
  19: { facade: 0.78 * 0.5, sky: 0.019 * 0.06 },
  21: { facade: 0.78 * 0.5, sky: 0.019 * 0.06 },
  0: { facade: 0.78 * 0.5, sky: 0.019 * 0.06 },
}

const library = await readPack()
const strip = await stripOf(library.catalogue)
const wall = shopfrontOf(library)
console.log(
  `shopfront: ${wall.bays} bays of ${wall.wide.toFixed(2)} by ${wall.tall.toFixed(2)} m, sill at ${wall.sill.toFixed(2)} m, ` +
    `${SHOPFRONT.deep} m deep, player ${stand} m off it at ${EYE} m`,
)

for (const hour of hours) {
  const look = nightLook(hour)
  const light = STREET_LIGHT[hour] ?? STREET_LIGHT[12]!
  console.log(
    `\n${String(hour).padStart(2, '0')}:00  level ${look.level.toFixed(2)}, lit ${look.lit.toFixed(2)} ` +
      `(${(litShare(look.lit, SHOPFRONT.keys) * 100).toFixed(0)}% of shopfronts have their lights on), ` +
      `facade ${light.facade.toFixed(2)}, sky in the glass ${light.sky.toFixed(3)}`,
  )
  console.log('  along the wall   facing   room    pane   the pane is')
  for (const across of [0, 1.5, 4, 8, 16]) {
    const seen = seenFrom(across, look, light)
    console.log(
      `  ${`${across} m`.padStart(14)}   ${seen.facing.toFixed(2)}    ${seen.room.toFixed(4)}  ${seen.pane.toFixed(4)}   ` +
        `${(seen.share * 100).toFixed(0)}% of the pixel`,
    )
  }
}

/** What one bay of the shopfront comes to, seen from `across` metres along the pavement. */
function seenFrom(across: number, look: { level: number; lit: number }, light: { facade: number; sky: number }) {
  const camera = { x: wall.wide / 2 + across, y: EYE, z: stand }
  let room = 0
  let pane = 0
  let facing = 0
  let taken = 0
  for (let bay = 0; bay < wall.bays; bay++) {
    for (let dv = 0; dv < GRID; dv++) {
      for (let du = 0; du < GRID; du++) {
        // the middle of a sample cell, over the opening alone: the surround and
        // the mullions are the wall's, and the pane draws nothing on them
        const at = {
          x: SHOPFRONT.frame.across + ((du + 0.5) / GRID) * (1 - 2 * SHOPFRONT.frame.across),
          y: SHOPFRONT.frame.down + ((dv + 0.5) / GRID) * (1 - 2 * SHOPFRONT.frame.down),
        }
        const point = { x: bay * wall.wide + at.x * wall.wide, y: wall.sill + (1 - at.y) * wall.tall, z: 0 }
        const view = unit({ x: point.x - camera.x, y: point.y - camera.y, z: point.z - camera.z })
        const cos = Math.max(-view.z, 0)

        const behind = wallAt(bay, at, view, look, light.facade)
        const front = paneOver(cos, look.level, light.sky)
        room += behind * (1 - front.opacity)
        pane += front.light
        facing += cos
        taken++
      }
    }
  }
  return { facing: facing / taken, room: room / taken, pane: pane / taken, share: pane / (pane + room) }
}

/**
 * The radiance leaving the wall behind the pane at this sample: the room's
 * picture as `src/material.ts` composes it, diffuse under the street's own
 * light plus what it burns after dark.
 */
function wallAt(bay: number, at: { x: number; y: number }, view: Vector, look: { level: number; lit: number }, facade: number): number {
  const id = baySeed(bay, 0)
  const flip = hashOf(id + SALT.mirror) >= 0.5
  const tint = ROOM_TINTS[Math.floor(hashOf(id + SALT.tint) * ROOM_TINTS.length)]!
  const lit = look.lit >= hashOf(id) * SHOPFRONT.keys
  const picture = boxedAt(bay, 0, true)
    ? marched(at, view, id, flip, hashOf(id + SALT.wall) >= 0.5)
    : sample(bank(strip.panels.street, id), flip ? 1 - at.x : at.x, at.y) * PANEL.dim

  const light = picture * luminance(tint) * shownAt(look.level, lit)
  return (light * ROOM.albedo * facade) / Math.PI + light * (ROOM.day + (ROOM.glow - ROOM.day) * look.level)
}

/** The room box of `src/roombox.ts`, marched in plain numbers. */
function marched(at: { x: number; y: number }, view: Vector, id: number, flip: boolean, swap: boolean): number {
  const ray = { x: view.x, y: -view.y, z: Math.max(-view.z, 1e-3) }
  const from = { x: at.x * wall.wide, y: at.y * wall.tall }
  const toSide = reach(from.x, wall.wide, ray.x)
  const toDeck = reach(from.y, wall.tall, ray.y)
  const toBack = SHOPFRONT.deep / ray.z
  const run = Math.min(toSide, toDeck, toBack)
  const met = { x: from.x + ray.x * run, y: from.y + ray.y * run, z: ray.z * run }
  const sideways = clamp(met.x / wall.wide)
  const downward = clamp(met.y / wall.tall)
  const behind = clamp(met.z / SHOPFRONT.deep)

  const onBack = toBack <= toSide && toBack <= toDeck
  const onSide = toSide < toBack && toSide <= toDeck
  const inward = ray.x >= 0 ? behind : 1 - behind
  const backward = ray.y >= 0 ? behind : 1 - behind
  const alt = Math.abs((ray.x >= 0 ? 1 : 0) - (swap ? 1 : 0)) > 0.5

  const layer = onBack
    ? bank(strip.rooms.street, id)
    : onSide
      ? (alt ? strip.faces.sideAlt : strip.faces.side)
      : ray.y >= 0
        ? strip.faces.floor
        : strip.faces.ceiling
  const u = onBack ? sideways : onSide ? inward : sideways
  const v = onBack ? downward : onSide ? downward : backward

  const seen = sample(layer, flip ? 1 - u : u, v)
  return seen * (NEAR_DARK + (1 - NEAR_DARK) * behind) * (onBack ? 1 : SIDE_DARK)
}

/** What the pane adds and what it takes off the room behind it, at this facing. */
function paneOver(cos: number, level: number, sky: number): { light: number; opacity: number } {
  const seen = paneAt(cos)
  const reflected = envBrdf(cos) * sky
  const street = luminance(STREET) * seen.reflected * level
  return { light: reflected + street, opacity: seen.reflected }
}

/**
 * The split-sum term the standard model reflects an environment by, in Karis's
 * analytic form: what share of the dome a dielectric at `PANE.roughness` gives
 * back at this facing.
 */
function envBrdf(cos: number): number {
  const r = { x: -PANE.roughness + 1, y: -0.0275 * PANE.roughness + 0.0425, z: -0.572 * PANE.roughness + 1.04, w: 0.022 * PANE.roughness - 0.04 }
  const a004 = Math.min(r.x * r.x, 2 ** (-9.28 * cos)) * r.x + r.y
  return PANE.reflectance * (-1.04 * a004 + r.z) + (1.04 * a004 + r.w)
}

/** Which layer of a bank this bay draws, the fold `src/interior.ts` takes of its own hash. */
function bank(of: Bank, id: number): number {
  return of.first + Math.floor(hashOf(id + SALT.picture) * of.count)
}

/** The strip at this point, as linear luminance. */
function sample(layer: number, u: number, v: number): number {
  const x = Math.min(ROOM_SIZE - 1, Math.max(0, Math.floor(u * ROOM_SIZE)))
  const y = Math.min(ROOM_SIZE - 1, Math.max(0, Math.floor(v * ROOM_SIZE)))
  return strip.pixels[layer * ROOM_SIZE * ROOM_SIZE + y * ROOM_SIZE + x]!
}

interface Vector {
  x: number
  y: number
  z: number
}

function unit(of: Vector): Vector {
  const length = Math.hypot(of.x, of.y, of.z) || 1
  return { x: of.x / length, y: of.y / length, z: of.z / length }
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function reach(from: number, size: number, ray: number): number {
  return (ray >= 0 ? size - from : from) / Math.max(Math.abs(ray), 1e-4)
}

function luminance(rgb: readonly [number, number, number]): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

/** The glazing strip's pictures as linear luminance, one plane per layer. */
async function stripOf(catalogue: Catalogue): Promise<GlazingStrip & { pixels: Float32Array }> {
  const file = new URL('../pack/buildings-rooms.png', import.meta.url)
  const { data, info } = await sharp(readFileSync(file)).raw().toBuffer({ resolveWithObject: true })
  const pixels = new Float32Array(info.width * info.height)
  for (let at = 0; at < pixels.length; at++) {
    const i = at * info.channels
    pixels[at] = 0.2126 * srgb(data[i]!) + 0.7152 * srgb(data[i + 1]!) + 0.0722 * srgb(data[i + 2]!)
  }
  return { ...catalogue.atlas.rooms, pixels }
}

function srgb(byte: number): number {
  const value = byte / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

/** One real shopfront out of the pack: how many bays it runs, how big one is, and where its sill sits. */
function shopfrontOf(of: Awaited<ReturnType<typeof readPack>>): { bays: number; wide: number; tall: number; sill: number } {
  const glass = of.catalogue.atlas.finishes.indexOf('glass')
  for (const model of of.catalogue.models) {
    const geometry = of.geometry(model.id)
    if (!geometry) continue
    const found = plateOf(geometry, glass)
    if (found) return found
  }
  throw new Error('no model in the pack carries a glass plate')
}

/** The widest glass face of one model, as the bays the shader cuts into it. */
function plateOf(geometry: THREE.BufferGeometry, glass: number): { bays: number; wide: number; tall: number; sill: number } | undefined {
  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  const layers = geometry.getAttribute(LAYER_ATTRIBUTE)
  const index = geometry.getIndex()
  if (!index) return undefined

  let best: { bays: number; wide: number; tall: number; sill: number } | undefined
  for (let at = 0; at + 2 < index.count; at += 3) {
    const tri = [index.getX(at), index.getX(at + 1), index.getX(at + 2)] as const
    if (tri.some((vertex) => Math.round(layers.getX(vertex!)) !== glass)) continue
    const points = tri.map((vertex) => ({
      u: uv.getX(vertex!),
      v: uv.getY(vertex!),
      x: position.getX(vertex!),
      y: position.getY(vertex!),
      z: position.getZ(vertex!),
    }))
    const du = span(points.map((point) => point.u))
    const dv = span(points.map((point) => point.v))
    if (du < 1e-6 || dv < 1e-6) continue
    const run = Math.hypot(span(points.map((point) => point.x)), span(points.map((point) => point.z)))
    const rise = span(points.map((point) => point.y))
    const plate = {
      bays: Math.round(du * SHOPFRONT.grid.across),
      wide: run / du / SHOPFRONT.grid.across,
      tall: rise / dv / SHOPFRONT.grid.down,
      sill: Math.min(...points.map((point) => point.y)),
    }
    if (plate.tall < SHOPFRONT.shortest || plate.bays < 1) continue
    if (!best || plate.wide * plate.bays > best.wide * best.bays) best = plate
  }
  return best
}

function span(of: readonly number[]): number {
  return Math.max(...of) - Math.min(...of)
}
