import { describe, expect, it } from 'vitest'
import { PlayerState, type PlayerStateDoc } from '../src/index.ts'

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
    expect(player.spend(5).ok).toBe(true)
    expect(player.money).toBe(20)

    const broke = player.spend(999)
    expect(broke.ok).toBe(false)
    if (!broke.ok && broke.error.code === 'not-enough-money') expect(broke.error.held).toBe(20)
    expect(player.money).toBe(20)
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
