import type { World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { flavourOf } from '../src/theme/flavour.ts'
import { keystoneOf, stapleSet } from '../src/theme/plot-mix.ts'
import { planned } from './support.ts'

const mixOf = (kinds: readonly string[]) => {
  const counts = new Map<string, number>()
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1)
  return [...counts.entries()].sort().map(([kind, n]) => `${kind}:${n}`).join(' ')
}

/** How many of the kinds a town can be known for it actually holds. */
const known = (world: World): number => stapleSet(world.charters()).filter((charter) => world.plotsOfKind(charter.word).length > 0).length

describe('a town reads as the kind of town it was asked for', () => {
  it('reads a free-text theme as one of the kinds of town it knows', () => {
    expect(flavourOf('dusty western mining town')).toBe('frontier')
    expect(flavourOf('quiet coastal town')).toBe('coastal')
    expect(flavourOf('dense neon port city')).toBe('neon')
    expect(flavourOf('a place')).toBe('plain')
  })

  it('builds a different town out of the same seed under a different theme', () => {
    const themes = ['quiet coastal town', 'dusty western mining town', 'dense neon port city']
    // enough towns that the theme is what is being measured: one town's own
    // history moves its mix as hard as the theme does, so three of them is a
    // sample of premises, not of themes
    const seeds = ['one-seed', 'two-seed', 'three-seed', 'four-seed', 'five-seed', 'six-seed']
    const built = themes.flatMap((theme) => seeds.map((seed) => planned(seed, { theme })))
    const mixes = built.map((town) => mixOf(town.plots().map((plot) => plot.kind)))
    expect(new Set(mixes).size).toBe(built.length)

    const count = (theme: string, kind: string) =>
      built.filter((town) => town.theme === theme).reduce((total, town) => total + town.plotsOfKind(kind).length, 0)

    // a neon city stacks people up and works in offices; a mining town spreads out and has chapels
    expect(count('dense neon port city', 'apartment')).toBeGreaterThan(count('dense neon port city', 'house'))
    expect(count('dense neon port city', 'office')).toBeGreaterThan(count('dusty western mining town', 'office'))
    expect(count('dusty western mining town', 'house')).toBeGreaterThan(count('dusty western mining town', 'apartment') * 3)
    expect(count('dusty western mining town', 'chapel')).toBeGreaterThan(count('dense neon port city', 'chapel'))

    for (const town of built) expect(known(town)).toBeGreaterThanOrEqual(2)
  })

  it('does not put the same two places on the same two sites in every town', () => {
    const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const towns = seeds.map((seed) => planned(`sites-${seed}`))
    const firstSites = towns.map((town) => town.plots()[0]!.kind)
    const mixes = towns.map((town) => mixOf(town.plots().map((plot) => plot.kind)))

    expect(new Set(firstSites).size).toBeGreaterThan(2)
    expect(new Set(mixes).size).toBe(seeds.length)

    for (const world of towns) {
      // its keystone, which is its bar until a history declares something ahead of it, and one to three more places the theme is known for
      expect(keystoneOf(world.charters())?.word).toBe('bar')
      expect(world.plotsOfKind('bar').length).toBeGreaterThanOrEqual(1)
      expect(known(world)).toBeGreaterThanOrEqual(2)
    }
  })
})
