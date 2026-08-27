import type { CastPart } from '../narrator.ts'

/** Somebody the town's work names, and what it needs them for. */
export interface Casting {
  readonly npcId: string
  readonly part: CastPart
  readonly questId: string
  readonly questTitle: string
  readonly questKind: 'main' | 'side'
  /** The line they are named on, as the player reads it. */
  readonly line: string
}

/**
 * Everybody the town's work names, read off the work itself.
 *
 * The quests are written against the bare architecture, so what they name is a
 * post the plan cut rather than somebody who was invented first. This reads the
 * drafts back and says who has to be standing where: the person handing a job
 * out, the person it sends the player to find, the person it wants a thing
 * delivered to, the person it asks the player to walk somewhere. That list is
 * what the last pass writes the people to, so a step that says "talk to Ada"
 * cannot land in a room Ada was never put in.
 *
 * It is derived rather than declared. A cast a writer asserts beside its quest
 * can disagree with the quest's own steps; one read off the steps cannot.
 * Drafts are whatever a narrator handed over, so nothing here trusts a shape.
 */
export function castOf(drafts: readonly unknown[]): Casting[] {
  const cast: Casting[] = []
  const seen = new Set<string>()

  for (const draft of drafts) {
    const quest = asRecord(draft)
    if (!quest) continue
    const questId = asText(quest.id)
    const questTitle = asText(quest.title)
    const questKind = quest.kind === 'main' ? 'main' : 'side'
    if (!questId) continue

    const take = (npcId: unknown, part: CastPart, line: string): void => {
      const id = asText(npcId)
      const key = `${questId}/${id}/${part}`
      if (!id || seen.has(key)) return
      seen.add(key)
      cast.push({ npcId: id, part, questId, questTitle, questKind, line })
    }

    take(quest.giverNpcId, 'giver', asText(quest.summary) || questTitle)
    for (const raw of asList(quest.steps)) {
      const step = asRecord(raw)
      if (!step) continue
      const line = asText(step.objective) || questTitle
      if (step.kind === 'talk') take(step.npcId, 'talk-to', line)
      if (step.kind === 'deliver') take(step.toNpcId, 'deliver-to', line)
      if (step.kind === 'escort') take(step.npcId, 'walk-with', line)
      for (const rawEffect of asList(step.effects)) {
        const effect = asRecord(rawEffect)
        if (effect?.kind === 'companion-join') take(effect.npcId, 'walk-with', line)
      }
    }
  }
  return cast
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined

const asList = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : [])

const asText = (value: unknown): string => (typeof value === 'string' ? value : '')
