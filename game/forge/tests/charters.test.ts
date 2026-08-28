import { Rng } from '@gb/kit'
import { RECIPES } from '@gb/kitbash'
import { SHIPPED_CHARTERS, type Charter, type Premise } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { drawOf } from '../src/interior/draw.ts'
import { planInterior } from '../src/interior/plan.ts'
import { kindWeights, stapleKinds } from '../src/theme/plot-mix.ts'
import { JAIL, LOCKUP } from './histories.ts'
import { planned } from './support.ts'

const town = (seed: string, history: unknown) => planned(seed, { theme: 'quiet market town', blocksX: 3, blocksY: 3 }, history)

describe('a kind of place the history invents', () => {
  it('puts up plots of that kind, resolved off the kit, and says in the file what it is', () => {
    const world = town('lockup', LOCKUP)

    expect(world.check()).toEqual([])
    expect(world.charter('jail')?.blade).toBe('JAIL')
    // the wall pieces are the kit's own row for how the jail meets the street, so it is drawn as the file says
    expect(world.charter('jail')?.built).toEqual(RECIPES[JAIL.street.frontage][JAIL.street.openness])
    expect(world.charters().length).toBe(SHIPPED_CHARTERS.length + LOCKUP.charters!.length)

    const jails = world.plotsOfKind('jail')
    expect(jails.length, 'the town has no jail').toBeGreaterThan(0)
    for (const jail of jails) expect(jail.storeys).toBeGreaterThanOrEqual(2)
  })

  it('plans the inside of an invented kind the way it plans a preset', () => {
    // nothing about a kind of place is a word this box knows: a jail's rooms,
    // its beds and the guard on its door all come off the charter's own axes
    let minted = 0
    const inside = planInterior({
      charter: JAIL,
      size: { w: 11.6, h: 9.6 },
      entrance: 'north',
      wants: { dancing: false },
      interiorId: 'interior_0001',
      mint: (thing: string) => `${thing}_${String(++minted).padStart(4, '0')}`,
      rng: new Rng('lockup'),
    })

    expect(inside.rooms.map((room) => room.use)).toContain('ward')
    expect(inside.rooms.map((room) => room.name)).toContain('Cells')
    expect(inside.anchors.map((anchor) => anchor.kind)).toContain('sleep')
    // a charter whose work includes `watch` gets somebody on the door
    expect(inside.anchors.map((anchor) => anchor.kind)).toContain('guard')
    // and the room its charter marks shut is locked, with a card for it: a civic finish issues cards
    expect(inside.shut.length).toBeGreaterThan(0)
    expect(inside.keys.map((key) => key.room)).toContain('Evidence room')
    expect(inside.keys.every((key) => key.archetype === 'keycard')).toBe(true)
  })

  it('drops a charter that fails the shape, strips the word from the build, and keeps the history', () => {
    const bad = { ...JAIL, word: 'vault', blade: 'vault', rooms: { main: { use: 'ward', name: 'Vault' }, services: [] } }
    const world = town('vault', { ...LOCKUP, charters: [JAIL, bad], build: { moreOf: ['vault'], fewerOf: [], mustHave: ['jail', 'vault'] } })

    expect(world.charter('vault')).toBeUndefined()
    expect(world.premise()?.build).toEqual({ moreOf: [], fewerOf: [], mustHave: ['jail'] })
    expect(world.premise()?.livesOn).toBe(LOCKUP.livesOn)
    expect(world.plotsOfKind('jail').length).toBeGreaterThan(0)
  })

  it('draws every other kind the same with one more kind declared', () => {
    // every per-kind draw is forked on the word, so declaring a jail moves no
    // house, bar or chapel the seed already rolled
    const extra: Charter = { ...JAIL, word: 'annexe', prominence: 'background', service: 'none', work: [], residential: true }
    const build: Premise['build'] = { moreOf: [], fewerOf: ['hotel'], mustHave: [] }
    for (const seed of ['one', 'two', 'three']) {
      const alone = kindWeights('plain', new Rng(seed), SHIPPED_CHARTERS, build)
      const joined = kindWeights('plain', new Rng(seed), [...SHIPPED_CHARTERS, { ...extra, ...SHIPPED_CHARTERS[0]!, ...extra }], build)
      expect(joined.filter(([word]) => word !== 'annexe')).toEqual(alone)
      expect(stapleKinds('plain', new Rng(seed), [...SHIPPED_CHARTERS, { ...SHIPPED_CHARTERS[0]!, ...extra }])).toEqual(stapleKinds('plain', new Rng(seed), SHIPPED_CHARTERS))
    }
  })

  it('weighs two different jails in one process as two different places', () => {
    const cells = drawOf(JAIL)
    const dormitory = drawOf({ ...JAIL, service: 'none', work: [], rooms: { main: { use: 'bedroom', name: 'Dormitory' }, services: [] } })
    expect(cells.serves).toBeGreaterThan(0)
    expect(dormitory.serves).toBe(0)
    expect(drawOf(JAIL)).toEqual(cells)
  })
})
