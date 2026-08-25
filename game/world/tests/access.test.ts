import { describe, expect, it } from 'vitest'
import { PLAYER, questView, World, type ItemInput, type Placement } from '../src/index.ts'
import { docOf, house, problemsOf, unwrap, violationsOf } from './house.ts'

/** A thing lying in the front room of the house. */
function drop(itemId: string, interiorId: string, anchorId: string): Placement {
  return { at: 'anchor', itemId, interiorId, anchorId }
}

describe('locks and what opens them', () => {
  it('takes a locked door with a password, a key or a card that names it, and refuses one nothing opens', () => {
    const { world, interior, doors, rooms } = house()
    const anchor = world.mintId('anchor')
    interior.anchors.push({ id: anchor, kind: 'stand', roomId: rooms.front, pos: { x: 2, y: 2 }, rot: 0 })
    interior.doors[1]!.locked = true
    unwrap(world.addInterior(interior))
    expect(world.check().map((p) => p.message)).toContainEqual(expect.stringContaining(`${doors.inner} is locked with nothing that opens it`))

    const password = docOf(world)
    password.interiors[0].doors[1].password = 'orchid-9'
    const typed = unwrap(World.load(password))
    expect(typed.door(doors.inner)).toEqual({ interiorId: interior.id, door: expect.objectContaining({ locked: true, password: 'orchid-9' }) })
    expect(questView(typed).hasDoor(doors.inner)).toBe(true)
    expect(questView(typed).hasDoor('door_9999')).toBe(false)

    const card: ItemInput = { id: world.mintId('item'), name: 'Study card', description: 'A white card.', archetype: 'keycard', opens: { doorId: doors.inner } }
    unwrap(world.addItem(card, drop(card.id, interior.id, anchor)))
    expect(world.check()).toEqual([])
    expect(unwrap(World.load(docOf(world))).item(card.id)?.opens).toEqual({ doorId: doors.inner })

    // a card for the house opens its street door, and no door inside it
    const front = docOf(world)
    front.items[0].opens = { interiorId: interior.id }
    expect(problemsOf(World.load(front))).toContainEqual(expect.stringContaining('nothing that opens it'))
    front.interiors[0].doors[1].locked = false
    front.interiors[0].doors[0].locked = true
    expect(World.load(front).ok).toBe(true)

    const stray = docOf(world)
    stray.items[0].opens = { doorId: 'door_9999' }
    expect(problemsOf(World.load(stray))).toContainEqual(expect.stringContaining('opens unknown door door_9999'))
  })

  it('lets only a key or a card open something, and only a deed be ownership of a place', () => {
    const { world, interior, rooms } = house()
    const anchor = world.mintId('anchor')
    interior.anchors.push({ id: anchor, kind: 'stand', roomId: rooms.front, pos: { x: 2, y: 2 }, rot: 0 })
    unwrap(world.addInterior(interior))
    const at = (id: string) => drop(id, interior.id, anchor)

    const bottle = world.addItem({ id: world.mintId('item'), name: 'Bottle', description: 'Empty.', archetype: 'bottle', opens: { interiorId: interior.id } }, at('item_0001'))
    expect(violationsOf(bottle)).toEqual(['opens'])
    const blank = world.addItem({ id: world.mintId('item'), name: 'Deed', description: 'Unsigned.', archetype: 'deed' }, at('item_0002'))
    expect(violationsOf(blank)).toEqual(['deedTo'])
    const bookish = world.addItem({ id: world.mintId('item'), name: 'Book', description: 'Thick.', archetype: 'book', deedTo: interior.id }, at('item_0003'))
    expect(violationsOf(bookish)).toEqual(['deedTo'])

    const deed = unwrap(world.addItem({ id: world.mintId('item'), name: 'Deed', description: 'Signed.', archetype: 'deed', deedTo: interior.id }, at('item_0004')))
    expect(deed.deedTo).toBe(interior.id)
    const lost = docOf(world)
    lost.items[0].deedTo = 'interior_9999'
    expect(problemsOf(World.load(lost))).toContainEqual(expect.stringContaining('deed to unknown interior'))
  })
})

describe('whose a place is', () => {
  it('keeps the owner and the price, and makes the place the player\'s when the deed is bought', () => {
    const { world, interior } = house()
    const anchor = world.mintId('anchor')
    interior.anchors.push({ id: anchor, kind: 'stand', roomId: interior.rooms[0]!.id, pos: { x: 2, y: 2 }, rot: 0 })
    const owner = world.mintId('npc')
    unwrap(world.addInterior({ ...interior, owner, forSale: 1200 }))
    unwrap(world.addNpc({ id: owner, name: 'Hollis', role: 'resident', appearance: { base: 'male', variant: 1 }, station: { interiorId: interior.id, anchorId: anchor }, personality: 'Selling up.', knowledge: [] }))
    expect(world.check()).toEqual([])
    expect(world.interior(interior.id)).toEqual(expect.objectContaining({ owner, forSale: 1200 }))
    expect(world.home()).toBeUndefined()

    const bought = unwrap(world.recordOwner(interior.id, PLAYER))
    expect(bought.owner).toBe(PLAYER)
    expect('forSale' in bought).toBe(false)
    expect(world.home()?.id).toBe(interior.id)
    expect(world.homes().map((h) => h.id)).toEqual([interior.id])

    const saved = JSON.stringify(world.toJSON())
    const reloaded = unwrap(World.load(JSON.parse(saved)))
    expect(JSON.stringify(reloaded.toJSON())).toBe(saved)
    expect(reloaded.home()?.id).toBe(interior.id)

    const nobody = world.recordOwner(interior.id, 'npc_9999')
    expect(nobody.ok).toBe(false)
    if (!nobody.ok) expect(nobody.error.code).toBe('unknown-reference')
    expect(world.recordOwner('interior_9999', PLAYER).ok).toBe(false)

    const doc = docOf(world)
    doc.interiors[0].owner = 'npc_9999'
    expect(problemsOf(World.load(doc))).toContainEqual(expect.stringContaining('owner npc_9999 does not exist'))
    doc.interiors[0].owner = 'landlord'
    expect(violationsOf(World.load(doc))).toContain('interiors.0.owner')
  })
})
