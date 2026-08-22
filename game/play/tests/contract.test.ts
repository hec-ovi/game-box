import { describe, expect, it } from 'vitest'
import { PlayerState } from '../src/index.ts'

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
})
