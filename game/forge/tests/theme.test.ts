import type { BuildingKind } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { flavourOf } from '../src/theme/flavour.ts'
import { stapleSet } from '../src/theme/plot-mix.ts'
import { buildTown } from './support.ts'

const mixOf = (kinds: readonly BuildingKind[]) => {
  const counts = new Map<BuildingKind, number>()
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1)
  return [...counts.entries()].sort().map(([kind, n]) => `${kind}:${n}`).join(' ')
}

describe('a town reads as the kind of town it was asked for', () => {
  it('reads a free-text theme as one of the kinds of town it knows', () => {
    expect(flavourOf('dusty western mining town')).toBe('frontier')
    expect(flavourOf('quiet coastal town')).toBe('coastal')
    expect(flavourOf('dense neon port city')).toBe('neon')
    expect(flavourOf('a place')).toBe('plain')
  })

  it('builds a different town out of the same seed under a different theme', async () => {
    const themes = ['quiet coastal town', 'dusty western mining town', 'dense neon port city']
    const seeds = ['one-seed', 'two-seed', 'three-seed']
    const built = await Promise.all(themes.flatMap((theme) => seeds.map((seed) => buildTown(seed, { theme }))))
    const mixes = built.map((town) => mixOf(town.world.plots().map((plot) => plot.kind)))
    expect(new Set(mixes).size).toBe(built.length)

    const count = (theme: string, kind: BuildingKind) =>
      built.filter((town) => town.world.theme === theme).reduce((total, town) => total + town.world.plotsOfKind(kind).length, 0)

    // a neon city stacks people up and works in offices; a mining town spreads out and has chapels
    expect(count('dense neon port city', 'apartment')).toBeGreaterThan(count('dense neon port city', 'house'))
    expect(count('dense neon port city', 'office')).toBeGreaterThan(count('dusty western mining town', 'office'))
    expect(count('dusty western mining town', 'house')).toBeGreaterThan(count('dusty western mining town', 'apartment') * 3)
    expect(count('dusty western mining town', 'chapel')).toBeGreaterThan(count('dense neon port city', 'chapel'))

    for (const town of built) {
      const staples = stapleSet(flavourOf(town.world.theme))
      expect(staples.filter((kind) => town.world.plotsOfKind(kind).length > 0).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('does not put the same two places on the same two sites in every town', async () => {
    const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const towns = await Promise.all(seeds.map((seed) => buildTown(`sites-${seed}`)))
    const firstSites = towns.map((town) => town.world.plots()[0]!.kind)
    const mixes = towns.map((town) => mixOf(town.world.plots().map((plot) => plot.kind)))

    expect(new Set(firstSites).size).toBeGreaterThan(2)
    expect(new Set(mixes).size).toBe(seeds.length)

    for (const { world } of towns) {
      // its bar, and one to three more places the theme is known for
      expect(world.plotsOfKind('bar').length).toBeGreaterThanOrEqual(1)
      const staples = stapleSet(flavourOf(world.theme)).filter((kind) => world.plotsOfKind(kind).length > 0)
      expect(staples.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('gives the people their own names and their own things to say', async () => {
    const towns = await Promise.all([buildTown('talk-1'), buildTown('talk-2'), buildTown('talk-3', { theme: 'quiet coastal town' })])
    const npcs = towns.flatMap((town) => town.world.npcs())
    const names = new Set(npcs.map((npc) => npc.name))
    const first = new Set(npcs.map((npc) => npc.name.split(' ')[0]))
    const surnames = new Set(npcs.map((npc) => npc.name.split(' ')[1]))
    const personalities = new Set(npcs.map((npc) => npc.personality))
    // the first line is where they work; the rest is what they know
    const said = npcs.flatMap((npc) => npc.knowledge.slice(1))
    const times = new Map<string, number>()
    for (const line of said) times.set(line, (times.get(line) ?? 0) + 1)

    expect(npcs.length).toBeGreaterThan(40)
    // nobody in three towns should be recycling a name, a personality or one sentence
    expect(names.size).toBeGreaterThan(npcs.length * 0.9)
    expect(first.size).toBeGreaterThan(30)
    expect(surnames.size).toBeGreaterThan(25)
    expect(personalities.size).toBeGreaterThan(npcs.length * 0.9)
    expect(times.size).toBeGreaterThan(30)
    expect(Math.max(...times.values())).toBeLessThan(npcs.length / 4)
  })
})
