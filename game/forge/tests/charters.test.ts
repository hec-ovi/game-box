import { Rng } from '@gb/kit'
import { RECIPES } from '@gb/kitbash'
import { SHIPPED_CHARTERS } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { drawOf } from '../src/interior/draw.ts'
import { planInterior } from '../src/interior/plan.ts'
import { JAIL, LOCKUP } from './histories.ts'
import { planned } from './support.ts'

const town = (seed: string, history: unknown) => planned(seed, { theme: 'quiet market town', blocksX: 3, blocksY: 3 }, history)

describe('a kind of place the history invents', () => {
  it('declares the kind, resolved off the kit, and leaves the placing to the writing', () => {
    const world = town('lockup', LOCKUP)

    expect(world.check()).toEqual([])
    expect(world.charter('jail')?.blade).toBe('JAIL')
    // the wall pieces are the kit's own row for how the jail meets the street, so it is drawn as the file says
    expect(world.charter('jail')?.built).toEqual(RECIPES[JAIL.street.frontage][JAIL.street.openness])
    // the presets, the architecture's own placeholder, and what the history invented
    expect(world.charters().length).toBe(SHIPPED_CHARTERS.length + 1 + LOCKUP.charters!.length)

    // and no plot is one yet: a plan is buildings, and which of them is the jail is the writing's
    expect(world.plotsOfKind('jail')).toEqual([])
    expect(world.plotsOfKind('building').length).toBe(world.plots().length)
  })

  it('refuses a history that claims the word a building stands under', () => {
    const world = town('claimed', { ...LOCKUP, charters: [{ ...JAIL, word: 'building', blade: 'BUILDING' }] })

    // `building` is what every plot is called until the writing says otherwise,
    // so a history may not redefine it out from under the architecture
    expect(world.charter('building')?.label).toBe('building')
    expect(world.charter('building')?.rooms.main.name).toBe('Room')
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
    expect(world.charter('jail')).toBeDefined()
  })

  it('weighs a kind of building by what its own interior turns out to hold', () => {
    // the gate a charter goes through: its rooms have to plan into somewhere
    // somebody can stand, and nothing about it is read off its word
    for (const charter of SHIPPED_CHARTERS) {
      const draw = drawOf(charter)
      expect(draw.posts, `nobody can stand in a ${charter.word}`).toBeGreaterThan(0)
      expect(draw.staff + draw.seats + draw.beds + draw.stock, `${charter.word} offers nothing at all`).toBeGreaterThan(0)
      expect(drawOf(charter), `${charter.word} is weighed differently on a second look`).toEqual(draw)
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
