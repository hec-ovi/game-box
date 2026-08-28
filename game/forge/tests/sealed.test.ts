import { readFileSync } from 'node:fs'
import { validateQuest, type QuestDoc } from '@gb/quest'
import { questView, World, type WorldDoc } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { planned } from './support.ts'

/**
 * A city this box built and sealed before the streets were reseeded, quests and
 * all. It is never regenerated: regenerating it is deleting the only proof that
 * a file somebody was sent a year ago still opens.
 */
const SEALED = JSON.parse(readFileSync(new URL('./fixtures/sealed-city.json', import.meta.url), 'utf8')) as {
  brief: Record<string, unknown>
  world: WorldDoc
  quests: QuestDoc[]
}

describe('a city sealed by an older generator', () => {
  it('still opens, still holds together, and its quests still validate', () => {
    const loaded = World.load(SEALED.world)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    const sealed = loaded.value

    expect(sealed.check()).toEqual([])
    expect(sealed.plots().length).toBeGreaterThan(0)
    expect(SEALED.quests.length).toBeGreaterThan(0)
    for (const quest of SEALED.quests) {
      expect(validateQuest(quest, questView(sealed)).ok, quest.id).toBe(true)
    }

    // and it is genuinely an older city: this generator lays that seed out differently now
    const today = planned(String(SEALED.brief.seed), SEALED.brief)
    expect(today.grid.rows().join('')).not.toBe(sealed.grid.rows().join(''))
  })
})
