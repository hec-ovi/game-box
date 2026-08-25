import { FURNITURE_PROPS, PROP_SPECS, footprintOf, type FurnitureProp } from '@gb/world'
import type * as THREE from 'three'
import { Solid } from '../build/solid.ts'
import { BUILDERS, OPENS } from '../props/index.ts'
import { SCREEN_SLOTS, screeningOf } from '../screens/screening.ts'
import { tunedTo } from '../screens/tune.ts'
import { FURNISH_STYLES, type FurnishStyle } from '../style/palette.ts'
import { variantOf } from '../style/variant.ts'
import { contactHeight } from './contact.ts'

/** One prop in one language, ready to draw. */
export interface Built {
  /**
   * The piece, one entry per screening it can be tuned to. A piece with no
   * screen in it has exactly one, because there is nothing to tune.
   */
  readonly screens: readonly THREE.BufferGeometry[]
  /** The same piece with its leaf slid open, for a piece that opens. */
  readonly opened: THREE.BufferGeometry | undefined
  /** Metres off the floor of the surface a body meets, measured off what was built. */
  readonly contact: number | undefined
  readonly triangles: number
}

/** How a prop and a language are keyed together. */
export function keyOf(style: FurnishStyle, prop: FurnitureProp): string {
  return `${style}/${prop}`
}

/**
 * Builds the whole catalog, both languages, from one seed.
 *
 * Every prop is built once and shared: a room of six chairs is six objects over
 * one buffer, so memory does not grow with how much furniture a town has. The
 * variation is per prop kind rather than per instance, which is what keeps that
 * true and is also what a real room looks like: the chairs match.
 */
export function buildCatalog(seed: string): Map<string, Built> {
  const catalog = new Map<string, Built>()
  for (const style of FURNISH_STYLES) {
    for (const prop of FURNITURE_PROPS) catalog.set(keyOf(style, prop), buildProp(style, prop, seed))
  }
  return catalog
}

function buildProp(style: FurnishStyle, prop: FurnitureProp, seed: string): Built {
  const spec = PROP_SPECS[prop]
  const solid = draw(style, prop, seed, false)
  const geometry = solid.geometry()
  geometry.name = keyOf(style, prop)
  const screens = solid.lit
    ? Array.from({ length: SCREEN_SLOTS }, (_, slot) =>
        tunedTo(geometry, screeningOf(seed, slot), `${geometry.name}/${slot}`),
      )
    : [geometry]

  const opened = OPENS.includes(prop) ? draw(style, prop, seed, true).geometry() : undefined
  if (opened) opened.name = `${geometry.name}/open`

  return {
    screens,
    opened,
    contact: spec.contact && contactHeight([geometry], spec.contact.kind),
    triangles: solid.triangles,
  }
}

/** One prop drawn into a fresh solid, shut or open. */
function draw(style: FurnishStyle, prop: FurnitureProp, seed: string, open: boolean): Solid {
  const spec = PROP_SPECS[prop]
  const { width, depth } = footprintOf(prop)
  const solid = new Solid()
  BUILDERS[prop]({
    solid,
    variant: variantOf(style, prop, seed),
    width,
    depth,
    contact: spec.contact?.height ?? 0,
    staff: spec.staffContact ?? 0,
    height: spec.height ?? 0,
    open,
  })
  return solid
}
