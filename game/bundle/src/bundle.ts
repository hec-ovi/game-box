import { err, ok, type Result, type SchemaViolation } from '@gb/kit'
import { PlayerState } from '@gb/play'
import { QuestLog, validateQuest, type QuestDoc, type QuestProblem } from '@gb/quest'
import { questView, World, type IntegrityProblem } from '@gb/world'
import { comparePacks, type PackReport } from './packs.ts'
import { Ledger, type ResumeReport } from './resume/ledger.ts'
import { reconcilePlayer } from './resume/player.ts'
import { reconcileProgress } from './resume/progress.ts'
import { Resolver } from './resume/resolver.ts'
import { bundleContract, saveContract, type AssetPackRef, type BundleDoc, type SaveDoc } from './schema.ts'
import { contentHash } from './stable-json.ts'

export type BundleError =
  | { readonly code: 'invalid-bundle'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'unsound-world'; readonly problems: readonly IntegrityProblem[] }
  | { readonly code: 'broken-quest'; readonly questId: string; readonly problems: readonly QuestProblem[] }
  | { readonly code: 'content-changed'; readonly expected: string; readonly actual: string }
  | { readonly code: 'invalid-save'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'save-mismatch'; readonly message: string }

export interface OpenedBundle {
  readonly world: World
  readonly quests: readonly QuestDoc[]
  readonly requires: readonly AssetPackRef[]
  /** The art the file names against the art the reader said they have. */
  readonly packs: PackReport
  readonly contentHash: string
}

/** A playthrough back in play, and what of the save survived the city it was opened in. */
export interface Resumed {
  readonly player: PlayerState
  readonly log: QuestLog
  readonly report: ResumeReport
}

/**
 * The file a city travels in. Packing seals the world, its quests and the art
 * packs it needs behind one hash; opening proves the city is byte-for-byte the
 * one that was shared before anybody plays it.
 */
export class Bundle {
  static async pack(
    world: World,
    quests: readonly QuestDoc[],
    options: { requires?: readonly AssetPackRef[]; generator?: string; version?: string } = {},
  ): Promise<BundleDoc> {
    const body = {
      format: 'game-box.bundle' as const,
      schemaVersion: 1 as const,
      world: world.toJSON(),
      quests: [...quests],
      requires: [...(options.requires ?? [])],
      createdWith: { generator: options.generator ?? 'forge', version: options.version ?? '0.1.0' },
    }
    return { ...body, contentHash: await contentHash(body) }
  }

  /**
   * Open an untrusted bundle: shape, hash, world soundness, then every quest.
   * `have` is the art the reader has loaded. A city opens whatever the answer
   * is; `packs` says how far the reader's art is from the maker's.
   */
  static async open(value: unknown, have: readonly AssetPackRef[] = []): Promise<Result<OpenedBundle, BundleError>> {
    const parsed = bundleContract.parse(value)
    if (!parsed.ok) return err({ code: 'invalid-bundle', violations: parsed.error })
    const doc = parsed.value

    const { contentHash: claimed, ...body } = doc
    const actual = await contentHash(body)
    if (actual !== claimed) return err({ code: 'content-changed', expected: claimed, actual })

    const world = World.load(doc.world)
    if (!world.ok) {
      return world.error.code === 'inconsistent-world'
        ? err({ code: 'unsound-world', problems: world.error.problems })
        : err({ code: 'invalid-bundle', violations: 'violations' in world.error ? world.error.violations : [] })
    }

    const view = questView(world.value)
    const quests: QuestDoc[] = []
    for (const candidate of doc.quests) {
      const validated = validateQuest(candidate, view)
      if (!validated.ok) {
        return err({
          code: 'broken-quest',
          questId: (candidate as { id?: string }).id ?? 'unknown',
          problems:
            validated.error.code === 'broken-flow'
              ? validated.error.problems
              : validated.error.violations.map((v) => ({ where: v.path, message: v.message })),
        })
      }
      quests.push(validated.value)
    }

    return ok({
      world: world.value,
      quests,
      requires: doc.requires,
      packs: comparePacks(doc.requires, have),
      contentHash: claimed,
    })
  }

  /** A playthrough of this bundle, with what each quest was called so a rebuilt city cannot pass its work off as this one's. */
  static save(bundle: OpenedBundle, player: PlayerState, log: QuestLog): SaveDoc {
    return {
      format: 'game-box.save',
      schemaVersion: 1,
      worldId: bundle.world.id,
      contentHash: bundle.contentHash,
      player: player.toJSON(),
      questProgress: log.toJSON(),
      questTitles: Object.fromEntries(bundle.quests.map((quest) => [quest.id, quest.title])),
    }
  }

  /**
   * Resume a playthrough. A save from another version of this city (the hash
   * differs) is not refused: whatever still resolves here is kept, the rest is
   * dropped, and the report says which was which.
   */
  static resume(bundle: OpenedBundle, value: unknown): Result<Resumed, BundleError> {
    const parsed = saveContract.parse(value)
    if (!parsed.ok) return err({ code: 'invalid-save', violations: parsed.error })
    const doc = parsed.value
    if (doc.worldId !== bundle.world.id) return err({ code: 'save-mismatch', message: 'the save belongs to another city' })

    const resolve = new Resolver(bundle.world, bundle.quests, doc.questTitles ?? {})
    const ledger = new Ledger()
    const player = PlayerState.load(reconcilePlayer(doc.player, resolve, ledger), bundle.world.id)
    if (!player.ok) {
      return err({
        code: 'invalid-save',
        violations: player.error.code === 'invalid-save' ? player.error.violations : [{ path: 'worldId', message: player.error.code }],
      })
    }
    const log = QuestLog.load(reconcileProgress(doc.questProgress, resolve, ledger), bundle.quests, player.value)
    if (!log.ok) {
      return err({
        code: 'invalid-save',
        violations: log.error.code === 'invalid-progress' ? log.error.violations : [{ path: '(root)', message: log.error.code }],
      })
    }
    return ok({ player: player.value, log: log.value, report: ledger.report(doc.contentHash !== bundle.contentHash) })
  }
}
