import { contract } from '@gb/kit'
import { z } from 'zod'
import { isHiddenStep, type Step } from './schema.ts'

/** Why a quest ended badly: the flow reached a `fail` step, or one of its `failWhen` rules fired. */
export const FAIL_REASONS = ['fail-step', 'time-limit', 'npc-lost', 'item-lost'] as const
export type FailReason = (typeof FAIL_REASONS)[number]

export const QuestProgressSchema = z.object({
  format: z.literal('game-box.quest-progress'),
  schemaVersion: z.literal(1),
  quests: z.record(
    z.string(),
    z.object({
      status: z.enum(['unstarted', 'active', 'complete', 'failed']),
      open: z.array(z.string()),
      done: z.array(z.string()),
      /** Items already counted towards a step, so the same crate cannot be handed in twice. */
      credited: z.record(z.string(), z.array(z.string())).default({}),
      /** Hidden steps that have been shown to the player. */
      revealed: z.array(z.string()).default([]),
      /** Branches dropped because a rival branch of an any-of got there first. */
      abandoned: z.array(z.string()).default([]),
      /** The clock reading when the quest started, which is what a time limit counts from. */
      startedAt: z.number().int().min(0).default(0),
      /** Why it failed. Present exactly while `status` is `failed`. */
      failReason: z.enum(FAIL_REASONS).optional(),
    }),
  ),
})

export const questProgressContract = contract('quest-progress', QuestProgressSchema)
export type QuestProgressDoc = z.infer<typeof QuestProgressSchema>
export type QuestStatus = QuestProgressDoc['quests'][string]['status']

/** One quest's live state. The saved shape above is this, flattened. */
export interface Progress {
  status: QuestStatus
  open: Set<string>
  done: Set<string>
  credited: Map<string, Set<string>>
  revealed: Set<string>
  abandoned: Set<string>
  startedAt: number
  failReason?: FailReason
}

export function freshProgress(): Progress {
  return {
    status: 'unstarted',
    open: new Set(),
    done: new Set(),
    credited: new Map(),
    revealed: new Set(),
    abandoned: new Set(),
    startedAt: 0,
  }
}

export function restoreProgress(saved: QuestProgressDoc['quests'][string] | undefined): Progress {
  if (!saved) return freshProgress()
  return {
    status: saved.status,
    open: new Set(saved.open),
    done: new Set(saved.done),
    credited: new Map(Object.entries(saved.credited).map(([stepId, items]) => [stepId, new Set(items)])),
    revealed: new Set(saved.revealed),
    abandoned: new Set(saved.abandoned),
    startedAt: saved.startedAt,
    ...(saved.failReason ? { failReason: saved.failReason } : {}),
  }
}

export function storeProgress(progress: Progress): QuestProgressDoc['quests'][string] {
  const credited: Record<string, string[]> = {}
  for (const [stepId, items] of progress.credited) credited[stepId] = [...items]
  return {
    status: progress.status,
    open: [...progress.open],
    done: [...progress.done],
    credited,
    revealed: [...progress.revealed],
    abandoned: [...progress.abandoned],
    startedAt: progress.startedAt,
    ...(progress.failReason ? { failReason: progress.failReason } : {}),
  }
}

/** A hidden step nothing has revealed yet: it may be on the board, but the player has not been told about it. */
export function isSecret(step: Step, progress: Progress): boolean {
  return isHiddenStep(step) && !progress.revealed.has(step.id)
}
