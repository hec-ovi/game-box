import { describe, expect, it } from 'vitest'
import { FACT_LENGTH, MEMORY_CAP, PlayerState, type MemorySource, type PlayerStateDoc } from '../src/index.ts'

describe('PlayerState', () => {
  it('carries items, marks stolen ones, and gives them up', () => {
    const player = PlayerState.create('world_0001')
    player.take('item_0001')
    player.take('item_0002', { stolen: true })

    expect(player.has('item_0001')).toBe(true)
    expect(player.isStolen('item_0001')).toBe(false)
    expect(player.isStolen('item_0002')).toBe(true)

    expect(player.drop('item_0002').ok).toBe(true)
    expect(player.has('item_0002')).toBe(false)
    expect(player.isStolen('item_0002')).toBe(false)

    const missing = player.drop('item_0009')
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.error.code).toBe('missing-item')
  })

  it('keeps money non-negative and refuses what the player cannot afford', () => {
    const player = PlayerState.create('world_0001', 10)
    player.earn(15)
    expect(player.money).toBe(25)
    expect(player.pay(5).ok).toBe(true)
    expect(player.money).toBe(20)

    const broke = player.pay(999)
    expect(broke.ok).toBe(false)
    if (!broke.ok && broke.error.code === 'not-enough-money') expect(broke.error.held).toBe(20)
    expect(player.money).toBe(20)

    // a price that is not a whole number of credits is not a price
    const odd = player.pay(-3)
    expect(odd.ok).toBe(false)
    if (!odd.ok) expect(odd.error.code).toBe('invalid-amount')
    expect(player.pay(2.5).ok).toBe(false)
    expect(player.money).toBe(20)
  })

  it('buys a thing in one motion, or refuses and changes nothing', () => {
    const player = PlayerState.create('world_0001', 8)
    expect(player.buy('item_0005', 5).ok).toBe(true)
    expect(player.has('item_0005')).toBe(true)
    expect(player.money).toBe(3)

    const broke = player.buy('item_0006', 4)
    expect(broke.ok).toBe(false)
    if (!broke.ok) expect(broke.error.code).toBe('not-enough-money')
    expect(player.has('item_0006')).toBe(false)
    expect(player.money).toBe(3)

    const twice = player.buy('item_0005', 1)
    expect(twice.ok).toBe(false)
    if (!twice.ok) expect(twice.error.code).toBe('already-carried')
    expect(player.money).toBe(3)
  })

  it('clamps reputation and tracks flags and companions', () => {
    const player = PlayerState.create('world_0001')
    player.adjustReputation(60)
    player.adjustReputation(80)
    expect(player.reputation()).toBe(100)
    player.adjustReputation(-500)
    expect(player.reputation()).toBe(-100)
    expect(player.reputation('miners')).toBe(0)

    player.setFlag('met-mara', true)
    expect(player.flag('met-mara')).toBe(true)
    expect(player.flag('never-set')).toBe(false)

    player.addCompanion('npc_0003')
    player.addCompanion('npc_0003')
    expect(player.companions()).toEqual(['npc_0003'])
    player.removeCompanion('npc_0003')
    expect(player.isCompanion('npc_0003')).toBe(false)
  })

  it('round-trips a save and refuses one from another world', () => {
    const player = PlayerState.create('world_0001', 7)
    player.take('item_0001')
    player.setFlag('paid-tab', true)
    const saved = JSON.parse(JSON.stringify(player.toJSON()))

    const loaded = PlayerState.load(saved, 'world_0001')
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.value.money).toBe(7)
      expect(loaded.value.has('item_0001')).toBe(true)
      expect(loaded.value.flag('paid-tab')).toBe(true)
    }

    const foreign = PlayerState.load(saved, 'world_0002')
    expect(foreign.ok).toBe(false)
    if (!foreign.ok) expect(foreign.error.code).toBe('wrong-world')

    const broken = PlayerState.load({ ...saved, money: -5 }, 'world_0001')
    expect(broken.ok).toBe(false)
    if (!broken.ok) expect(broken.error.code).toBe('invalid-save')
  })

  it('remembers where the player was standing, out in the city and inside a room', () => {
    const player = PlayerState.create('world_0001')
    expect(player.where).toBeUndefined()

    player.setWhere({ x: 41.5, z: -12.25, heading: 2.1 })
    expect(player.where).toEqual({ x: 41.5, z: -12.25, heading: 2.1 })

    player.setWhere({ x: 2.5, z: 3, heading: 0.5, interiorId: 'interior_0007' })
    const reopened = reload(player)
    expect(reopened.where).toEqual({ x: 2.5, z: 3, heading: 0.5, interiorId: 'interior_0007' })
  })

  it('keeps a heading inside one turn and holds the last real place', () => {
    const player = PlayerState.create('world_0001')
    // the app's yaw winds up as the mouse turns; four turns on is still north-by-a-half
    player.setWhere({ x: 0, z: 0, heading: 4 * Math.PI + 0.5 })
    expect(player.where?.heading).toBeCloseTo(0.5, 10)

    player.setWhere({ x: 10, z: 20, heading: -Math.PI / 2 })
    expect(player.where?.heading).toBeCloseTo(1.5 * Math.PI, 10)

    player.setWhere({ x: Number.NaN, z: 20, heading: 0 })
    expect(player.where?.x).toBe(10)
    expect(reload(player).where?.x).toBe(10)
  })

  it('follows a quest, drops it, and still loads a save whose quest is gone', () => {
    const player = PlayerState.create('world_0001')
    expect(player.tracked).toBeUndefined()

    player.setTracked('quest_0002')
    expect(player.tracked).toBe('quest_0002')
    expect(reload(player).tracked).toBe('quest_0002')

    player.setTracked(null)
    expect(player.tracked).toBeUndefined()
    expect(reload(player).tracked).toBeUndefined()

    // the quest was given up in a session this box knows nothing about
    const stale = PlayerState.load({ ...saveOf(player), tracked: 'quest_gone' }, 'world_0001')
    expect(stale.ok).toBe(true)
    if (stale.ok) expect(stale.value.tracked).toBe('quest_gone')
  })

  it('leaves a thing on a surface, takes it back, and leaves it somewhere else', () => {
    const player = PlayerState.create('world_0001')
    player.take('item_0001', { stolen: true })

    const strongbox = { interiorId: 'interior_0003', anchorId: 'anchor_0012' }
    player.place('item_0001', strongbox)
    expect(player.has('item_0001')).toBe(false)
    expect(player.isStolen('item_0001')).toBe(false)
    expect(player.placedAt('item_0001')).toEqual(strongbox)

    const left = reload(player)
    expect(left.placed()).toEqual([{ itemId: 'item_0001', ...strongbox }])

    // picked back up: it is in hand, so it is standing on nothing
    left.take('item_0001')
    expect(left.placedAt('item_0001')).toBeUndefined()
    expect(reload(left).placed()).toEqual([])

    const shelf = { interiorId: 'interior_0009', anchorId: 'anchor_0044' }
    left.place('item_0001', shelf)
    expect(reload(left).placed()).toEqual([{ itemId: 'item_0001', ...shelf }])
  })

  it('opens a save naming a room this city lost, or a thing in two places at once', () => {
    const lost = { interiorId: 'interior_9999', anchorId: 'anchor_9999' }
    const saved = {
      ...saveOf(PlayerState.create('world_0001')),
      inventory: ['item_0002'],
      moved: [
        { itemId: 'item_0001', ...lost },
        { itemId: 'item_0002', interiorId: 'interior_0003', anchorId: 'anchor_0012' },
      ],
    }

    const loaded = PlayerState.load(saved, 'world_0001')
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    const player = loaded.value

    // the thing in hand is not also standing on a shelf
    expect(player.placedAt('item_0002')).toBeUndefined()
    // a room this city has not got is kept, for whoever knows the city to settle
    expect(player.placedAt('item_0001')).toEqual(lost)

    player.place('item_0001', null)
    expect(player.placed()).toEqual([])
    expect(reload(player).placed()).toEqual([])
  })

  it('records the places entered and the people met, and what was learned of each', () => {
    const player = PlayerState.create('world_0001')
    expect(player.discovered()).toEqual({ places: [], people: [] })

    player.discover({ place: 'interior_0003' })
    player.discover({ npc: 'npc_0002' })
    player.discover({ place: 'interior_0001' })
    player.discover({ place: 'interior_0003' })
    player.unlock('npc_0002', 'fact_0001')
    player.unlock('npc_0002', 'fact_0001')
    // learning of somebody from a third party lists them too
    player.unlock('npc_0007', 'fact_0004')
    player.discover({ npc: 'npc_0002' })

    const found = reload(player).discovered()
    expect(found.places).toEqual(['interior_0003', 'interior_0001'])
    expect(found.people).toEqual([
      { npcId: 'npc_0002', unlocked: ['fact_0001'] },
      { npcId: 'npc_0007', unlocked: ['fact_0004'] },
    ])
    expect(player.unlocked('npc_0002')).toEqual(['fact_0001'])
    expect(player.unlocked('npc_9999')).toEqual([])
  })

  it('lets each person hold a few facts, oldest dropped, and none of another person', () => {
    const player = PlayerState.create('world_0001')
    expect(player.remember('npc_0002', 'took a job from the rival bar', 'told').ok).toBe(true)
    expect(player.remember('npc_0002', 'took a job from the rival bar', 'told').ok).toBe(true)
    expect(player.remember('npc_0002', 'walked out mid sentence', 'seen').ok).toBe(true)
    expect(player.memories('npc_0002')).toEqual([
      { fact: 'took a job from the rival bar', source: 'told' },
      { fact: 'walked out mid sentence', source: 'seen' },
    ])
    expect(player.memories('npc_0003')).toEqual([])

    for (let n = 1; n <= MEMORY_CAP; n += 1) player.remember('npc_0002', `fact ${n}`, 'told')
    const held = reload(player).memories('npc_0002')
    expect(held).toHaveLength(MEMORY_CAP)
    expect(held[0]).toEqual({ fact: 'fact 1', source: 'told' })
    expect(held[MEMORY_CAP - 1]).toEqual({ fact: `fact ${MEMORY_CAP}`, source: 'told' })

    const blank = player.remember('npc_0002', '   ', 'told')
    expect(blank.ok).toBe(false)
    if (!blank.ok) expect(blank.error.code).toBe('bad-fact')
    expect(player.remember('npc_0002', 'x'.repeat(FACT_LENGTH + 1), 'told').ok).toBe(false)

    const gossip = player.remember('npc_0002', 'heard it in the street', 'overheard' as MemorySource)
    expect(gossip.ok).toBe(false)
    if (!gossip.ok) expect(gossip.error.code).toBe('unknown-source')
    expect(player.memories('npc_0002')).toHaveLength(MEMORY_CAP)
  })

  it('moves how one person feels along a closed scale without touching anyone else', () => {
    const player = PlayerState.create('world_0001')
    expect(player.disposition('npc_0002')).toBe('neutral')

    player.warm('npc_0002')
    expect(player.disposition('npc_0002')).toBe('warm')
    player.warm('npc_0002')
    player.warm('npc_0002')
    expect(player.disposition('npc_0002')).toBe('friendly')
    expect(player.disposition('npc_0003')).toBe('neutral')

    player.cool('npc_0003')
    player.cool('npc_0003')
    player.cool('npc_0003')
    expect(reload(player).disposition('npc_0003')).toBe('hostile')
    expect(reload(player).disposition('npc_0002')).toBe('friendly')

    // back at neutral with nothing held, a person takes no room in the save
    player.cool('npc_0002')
    player.cool('npc_0002')
    expect(saveOf(player).memory).toEqual({ npc_0003: { disposition: 'hostile', facts: [] } })
  })

  it('opens a save written before places were remembered', () => {
    const old = {
      format: 'game-box.player',
      schemaVersion: 1,
      worldId: 'world_0001',
      money: 12,
      inventory: ['item_0001'],
      stolen: [],
      flags: {},
      reputation: {},
      companions: [],
    }

    const loaded = PlayerState.load(old, 'world_0001')
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.value.money).toBe(12)
    expect(loaded.value.where).toBeUndefined()
    expect(loaded.value.tracked).toBeUndefined()
    expect(loaded.value.placed()).toEqual([])
    expect(loaded.value.discovered()).toEqual({ places: [], people: [] })
    expect(loaded.value.memories('npc_0001')).toEqual([])
    expect(loaded.value.disposition('npc_0001')).toBe('neutral')
  })
})

/** The save as it reaches the disk, so a test reads what a player's file really holds. */
function saveOf(player: PlayerState): PlayerStateDoc {
  return JSON.parse(JSON.stringify(player.toJSON()))
}

function reload(player: PlayerState): PlayerState {
  const loaded = PlayerState.load(saveOf(player), player.worldId)
  if (!loaded.ok) throw new Error(`save did not load: ${JSON.stringify(loaded.error)}`)
  return loaded.value
}
