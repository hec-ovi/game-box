import { describe, expect, it } from 'vitest'
import { FURNITURE_PROPS, MACHINE_PROPS, PROP_SPECS, questView, World, type FurnitureInput } from '../src/index.ts'
import { docOf, house, problemsOf, unwrap, violationsOf } from './house.ts'

describe('the machines in a room', () => {
  it('carries a machine on every screen and on nothing else, and finds it by its id', () => {
    const { world, interior, rooms } = house()
    const desk = world.mintId('prop')
    const top = PROP_SPECS.desk.contact!.height
    interior.furniture.push({ id: desk, prop: 'desk', roomId: rooms.back, pos: { x: 4, y: 6 }, rot: 0 })
    const terminal: FurnitureInput = {
      id: world.mintId('prop'),
      prop: 'terminal',
      roomId: rooms.back,
      pos: { x: 4, y: 6 },
      rot: 0,
      lift: top,
      on: desk,
      machine: { id: world.mintId('machine'), locked: true, password: 'orchid-9', program: 'ledger' },
    }
    const laptop: FurnitureInput = { ...terminal, id: world.mintId('prop'), prop: 'laptop', machine: { id: world.mintId('machine'), program: 'snake' } }
    interior.furniture.push(terminal, laptop)
    const added = unwrap(world.addInterior(interior))
    expect(added.furniture[2]!.machine).toEqual({ id: 'machine_0002', locked: false, program: 'snake' })
    expect(world.check()).toEqual([])

    const found = world.machine('machine_0001')
    expect(found?.interiorId).toBe(interior.id)
    expect(found?.furniture.machine).toEqual({ id: 'machine_0001', locked: true, password: 'orchid-9', program: 'ledger' })
    expect(questView(world).hasMachine('machine_0002')).toBe(true)
    expect(questView(world).hasMachine('machine_0009')).toBe(false)

    const saved = JSON.stringify(world.toJSON())
    expect(JSON.stringify(unwrap(World.load(JSON.parse(saved))).toJSON())).toBe(saved)

    const table = docOf(world)
    table.interiors[0].furniture[0].machine = { id: 'machine_0003', program: 'blank' }
    expect(violationsOf(World.load(table))).toContain('interiors.0.furniture.0.machine')
    const bare = docOf(world)
    delete bare.interiors[0].furniture[2].machine
    expect(violationsOf(World.load(bare))).toContain('interiors.0.furniture.2.machine')
    const doom = docOf(world)
    doom.interiors[0].furniture[2].machine.program = 'doom'
    expect(violationsOf(World.load(doom))).toContain('interiors.0.furniture.2.machine.program')
    const twice = docOf(world)
    twice.interiors[0].furniture[2].machine.id = 'machine_0001'
    expect(problemsOf(World.load(twice))).toContainEqual(expect.stringContaining('duplicate id machine_0001'))
  })

  it('points a camera at a room of its own interior, and stands a bars-door across a door of its own', () => {
    const { world, interior, rooms, doors } = house()
    interior.furniture.push({ id: world.mintId('prop'), prop: 'camera', roomId: rooms.front, pos: { x: 0.2, y: 0.2 }, rot: 135, lift: 2.4, watches: rooms.front })
    interior.furniture.push({ id: world.mintId('prop'), prop: 'bars-door', roomId: rooms.front, pos: { x: 4, y: 4 }, rot: 0, doorId: doors.inner })
    interior.doors[1]!.locked = true
    interior.doors[1]!.password = 'orchid-9'
    unwrap(world.addInterior(interior))
    expect(world.check()).toEqual([])

    const blind = docOf(world)
    delete blind.interiors[0].furniture[0].watches
    expect(violationsOf(World.load(blind))).toContain('interiors.0.furniture.0.watches')
    const elsewhere = docOf(world)
    elsewhere.interiors[0].furniture[0].watches = 'room_9999'
    expect(problemsOf(World.load(elsewhere))).toContainEqual(expect.stringContaining('watches unknown room room_9999'))

    const loose = docOf(world)
    delete loose.interiors[0].furniture[1].doorId
    expect(violationsOf(World.load(loose))).toContain('interiors.0.furniture.1.doorId')
    const nowhere = docOf(world)
    nowhere.interiors[0].furniture[1].doorId = 'door_9999'
    expect(problemsOf(World.load(nowhere))).toContainEqual(expect.stringContaining('across unknown door door_9999'))
    const tv = docOf(world)
    tv.interiors[0].furniture[1].prop = 'tv'
    expect(violationsOf(World.load(tv))).toContain('interiors.0.furniture.1.doorId')
  })

  it('sizes every screen to stand on a surface, the camera to hang on a wall, and the bars to block the opening', () => {
    for (const prop of MACHINE_PROPS) {
      expect(FURNITURE_PROPS).toContain(prop)
      expect(PROP_SPECS[prop].onSurface, prop).toBe(true)
    }
    expect(PROP_SPECS.camera).toEqual(expect.objectContaining({ mounted: true, blocks: false }))
    expect(PROP_SPECS['bars-door'].blocks).toBe(true)
    expect(PROP_SPECS['bars-door'].height).toBeGreaterThan(2)
  })
})
