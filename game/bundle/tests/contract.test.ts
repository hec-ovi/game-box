import { PlayerState } from '@gb/play'
import { QuestLog } from '@gb/quest'
import { describe, expect, it } from 'vitest'
import { Bundle } from '../src/index.ts'
import { errand, grow, laidOut } from './town.ts'

/** A town laid out, with one place open in it and a job to do there, sealed as a file. */
async function packedTown() {
  const world = laidOut('bundle-test')
  const [place] = grow(world, 1, { anchors: 2, people: 1, things: 2 })
  const doc = await Bundle.pack(world, [errand('quest_0001', 'The thing on the shelf', place!)], {
    requires: [{ pack: 'kenney-city', version: '1.0.0' }],
  })
  return { world, place: place!, doc }
}

describe('Bundle', () => {
  it('packs a city and opens it back as the same city', async () => {
    const { world, doc } = await packedTown()

    const opened = await Bundle.open(JSON.parse(JSON.stringify(doc)))
    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    expect(opened.value.world.name).toBe(world.name)
    expect(opened.value.world.plots().length).toBe(world.plots().length)
    expect(opened.value.quests.map((quest) => quest.id)).toEqual(['quest_0001'])
    expect(opened.value.requires[0]?.pack).toBe('kenney-city')
    expect(opened.value.contentHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('refuses a bundle whose contents were changed after it was sealed', async () => {
    const { doc } = await packedTown()
    const tampered = JSON.parse(JSON.stringify(doc))
    tampered.world.name = 'Somewhere Else'

    const opened = await Bundle.open(tampered)
    expect(opened.ok).toBe(false)
    if (!opened.ok) expect(opened.error.code).toBe('content-changed')
  })

  it('refuses a bundle carrying a quest that cannot be played', async () => {
    const { world, place } = await packedTown()
    const doc = await Bundle.pack(world, [errand('quest_0001', 'Fetch what is not there', place, 'item_9999')])

    const opened = await Bundle.open(doc)
    expect(opened.ok).toBe(false)
    if (!opened.ok && opened.error.code === 'broken-quest') {
      expect(opened.error.problems.some((p) => p.message.includes('item_9999'))).toBe(true)
    } else {
      throw new Error('expected broken-quest')
    }
  })

  it('refuses a document that is not a bundle', async () => {
    const opened = await Bundle.open({ format: 'something-else' })
    expect(opened.ok).toBe(false)
    if (!opened.ok) expect(opened.error.code).toBe('invalid-bundle')
  })

  it('saves a playthrough and resumes it, but not against another city', async () => {
    const { doc } = await packedTown()
    const opened = await Bundle.open(doc)
    if (!opened.ok) throw new Error('bundle did not open')

    const player = PlayerState.create(opened.value.world.id, 5)
    const log = QuestLog.create(opened.value.quests, player)
    const quest = opened.value.quests[0]!
    log.start(quest.id)
    player.earn(20)

    const save = Bundle.save(opened.value, player, log)
    const resumed = Bundle.resume(opened.value, JSON.parse(JSON.stringify(save)))
    expect(resumed.ok).toBe(true)
    if (resumed.ok) {
      expect(resumed.value.player.money).toBe(25)
      expect(resumed.value.log.status(quest.id)).toBe('active')
      expect(resumed.value.log.objectives().length).toBeGreaterThan(0)
      expect(resumed.value.report).toEqual({ rebuilt: false, kept: [{ kind: 'quest', id: quest.id }], dropped: [] })
    }

    const otherCity = { ...save, worldId: 'world_9999' }
    const wrong = Bundle.resume(opened.value, otherCity)
    expect(wrong.ok).toBe(false)
    if (!wrong.ok) expect(wrong.error.code).toBe('save-mismatch')

    const junk = Bundle.resume(opened.value, { format: 'nope' })
    expect(junk.ok).toBe(false)
    if (!junk.ok) expect(junk.error.code).toBe('invalid-save')
  })
})
