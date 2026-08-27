import * as THREE from 'three'

/**
 * What a surface is made of, carried per vertex rather than per material.
 *
 * Every piece of furniture in the game draws on one material, so a colour, an
 * emission and a finish ride on the geometry instead: see `material.ts`. That
 * is what lets a room of twenty pieces be one material and, once `@gb/scene`
 * batches interiors, one draw.
 */
export interface Look {
  /** Base colour, sRGB hex the way a colour picker gives it. */
  readonly colour: number
  /** Emitted colour, sRGB hex. Left out, the surface emits nothing. */
  readonly glow?: number
  /** How bright it emits. Over 1 is what bloom picks up. */
  readonly glowStrength?: number
  readonly roughness: number
  readonly metalness: number
}

/** A look with its colours already in the renderer's working space. */
export interface Shaded {
  readonly shade: readonly [number, number, number]
  readonly glow: readonly [number, number, number]
  readonly roughness: number
  readonly metalness: number
}

const BLACK: readonly [number, number, number] = [0, 0, 0]
const cache = new WeakMap<Look, Shaded>()

/** Resolves a look once and remembers it: a builder asks for the same one per vertex. */
export function shade(look: Look): Shaded {
  const found = cache.get(look)
  if (found) return found

  const resolved: Shaded = {
    shade: linear(look.colour),
    glow: look.glow === undefined ? BLACK : scaled(linear(look.glow), look.glowStrength ?? 1),
    roughness: look.roughness,
    metalness: look.metalness,
  }
  cache.set(look, resolved)
  return resolved
}

/**
 * How bright a colour reads, in the renderer's working space. A strength
 * multiplying a colour is not a brightness: the same number over a pale cyan
 * and over a saturated red emits two and a half times as much of the first, so
 * anything that has to read at a level is authored by this and the strength is
 * worked back from it.
 */
export function luminanceOf(hex: number): number {
  const [red, green, blue] = linear(hex)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function linear(hex: number): readonly [number, number, number] {
  const colour = new THREE.Color().setHex(hex, THREE.SRGBColorSpace)
  return [colour.r, colour.g, colour.b]
}

function scaled(rgb: readonly [number, number, number], by: number): readonly [number, number, number] {
  return [rgb[0] * by, rgb[1] * by, rgb[2] * by]
}
