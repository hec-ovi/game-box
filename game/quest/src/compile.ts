import { err, ok, type Result, type SchemaViolation } from '@gb/kit'
import { tierFor } from './balance.ts'
import { beatCount, beatPool, questSheetContract, type Beat, type PlainBeat, type QuestSheet } from './beats.ts'
import { Held } from './held.ts'
import { LINES } from './lines.ts'
import { markerLabel } from './marker.ts'
import type { QuestDoc, Step } from './schema.ts'
import { validateQuest, type QuestError } from './validate.ts'
import type { WorldView } from './world-view.ts'

/** One beat that could not be made into a flow, pointed at the beat it is about. */
export interface BeatProblem {
  /** `beats.3`, `beats.3.options.0.beats.1`, `giverNpcId`, `reward.items`. */
  readonly where: string
  readonly message: string
}

export type SheetError =
  | { readonly code: 'invalid-sheet'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'unwritable-beat'; readonly problems: readonly BeatProblem[] }

export interface CompiledQuest {
  readonly quest: QuestDoc
  /** Which beat each step came from, so a caller can point its own complaints back at the writing. */
  readonly beatOf: ReadonlyMap<string, string>
}

/**
 * Turns a sheet of beats into a quest that plays.
 *
 * The promise: what comes back passes `validateQuest` against the world it was
 * compiled for, or it says which beat could not be honoured and why, in the
 * same plain words a writer can be told for a second try.
 *
 * The compiler mints the step ids, wires the edges in the order the beats were
 * given, forks a choice into its roads and brings them back together, puts in
 * what the flow needs to be solvable (the pick-up in front of the hand-over
 * that needs it, the companion in front of the walk that needs one, the
 * ending), and settles the pay into the band the work belongs to. It invents
 * nobody and nowhere: a beat naming a person, a place or a thing the world has
 * not got is a refusal carrying that id, never a repair.
 */
export function compileQuest(value: unknown, world: WorldView): Result<CompiledQuest, SheetError> {
  const parsed = questSheetContract.parse(value)
  if (!parsed.ok) return err({ code: 'invalid-sheet', violations: parsed.error })
  return new Compiler(parsed.value, world).run()
}

/** As many steps as a quest document holds, which a run of beats with forks in it can outgrow. */
const MOST_STEPS = 60

/** A step while it is being built: one step kind's fields, plus the edges the compiler is still wiring. */
type StepDraft = Record<string, unknown> & { readonly id: string }

/** Something waiting to be told which step comes next. */
type Link = (stepId: string) => void

/** One beat with the place in the sheet it was written at. */
interface Entry {
  readonly beat: PlainBeat
  readonly where: string
}

/** The beats that put a thing in the player's hands, and the ones that take it out again. */
type Carrying = Extract<PlainBeat, { kind: 'collect' | 'buy' | 'deliver' | 'stash' }>

class Compiler {
  #sheet: QuestSheet
  #world: WorldView
  #steps: StepDraft[] = []
  #beatOf = new Map<string, string>()
  #open: Link[] = []

  constructor(sheet: QuestSheet, world: WorldView) {
    this.#sheet = sheet
    this.#world = world
  }

  run(): Result<CompiledQuest, SheetError> {
    const last = this.#sheet.beats.length - 1
    this.#segment(this.#sheet.beats, Held.empty(), 'beats')
    this.#place({ kind: 'complete', objective: LINES.done }, `beats.${last}`)

    if (this.#steps.length > MOST_STEPS) {
      const message = `this works out at ${this.#steps.length} steps, and a quest holds ${MOST_STEPS}: tell it in fewer beats`
      return err({ code: 'unwritable-beat', problems: [{ where: 'beats', message }] })
    }

    const validated = validateQuest(this.#document(), this.#world)
    if (!validated.ok) return err({ code: 'unwritable-beat', problems: this.#translate(validated.error) })
    return ok({ quest: validated.value, beatOf: this.#beatOf })
  }

  #document(): unknown {
    const sheet = this.#sheet
    return {
      format: 'game-box.quest',
      schemaVersion: 1,
      id: sheet.id,
      kind: sheet.kind,
      title: sheet.title,
      summary: sheet.summary,
      giverNpcId: sheet.giverNpcId,
      difficulty: sheet.difficulty ?? tierFor(sheet.reward),
      ...(sheet.requires ? { requires: sheet.requires } : {}),
      ...(sheet.failWhen ? { failWhen: sheet.failWhen } : {}),
      startStepId: this.#steps[0]?.id,
      steps: this.#steps,
      reward: sheet.reward,
    }
  }

  /**
   * Lays a run of beats down one after another and hands back what the player
   * is sure to be holding at the end of it. A beat pulled forward to keep a
   * later one solvable is laid down where it was needed and skipped when its
   * own turn comes.
   */
  #segment(beats: readonly Beat[], held: Held, path: string): Held {
    const waiting: Entry[] = beats.flatMap((beat, index) =>
      beat.kind === 'choice' ? [] : [{ beat, where: `${path}.${index}` }],
    )
    let state = held
    beats.forEach((beat, index) => {
      if (beat.kind === 'choice') {
        state = this.#fork(beat, state, `${path}.${index}`)
        return
      }
      const at = waiting.findIndex((entry) => entry.beat === beat)
      if (at < 0) return
      const [entry] = waiting.splice(at, 1)
      state = this.#plain(entry!, waiting, state)
    })
    return state
  }

  /** One beat that is not a fork, with whatever the flow needs in front of it. */
  #plain(entry: Entry, waiting: Entry[], held: Held): Held {
    const { beat, where } = entry
    let state = held
    if (beat.kind === 'deliver' || beat.kind === 'stash') state = this.#inHand(beat, where, waiting, state)
    if (beat.kind === 'escort' && !state.hasCompanion(beat.npcId)) state = this.#alongside(beat, where, state)
    this.#lead(stepFor(beat), where)
    return carried(beat, state)
  }

  /**
   * Makes sure the thing a beat hands over is in the player's hands by the time
   * they are asked for it. A beat that picks it up later in the same run is
   * moved in front of this one, because that is the writer's own step in the
   * wrong place. Only where nothing picks it up at all does the compiler write
   * a pick-up of its own, and then the beat's line rides along as the hint.
   */
  #inHand(beat: Carrying, where: string, waiting: Entry[], held: Held): Held {
    const pool = beatPool(beat)
    const wanted = beatCount(beat)
    let state = held

    while (state.available(pool) < wanted) {
      const found = waiting.findIndex((entry) => picksUp(entry.beat, pool))
      if (found < 0) break
      const [hoisted] = waiting.splice(found, 1)
      this.#lead(stepFor(hoisted!.beat), hoisted!.where)
      state = carried(hoisted!.beat, state)
    }

    const short = wanted - state.available(pool)
    if (short <= 0) return state
    this.#lead(
      {
        kind: 'collect',
        itemId: beat.itemId,
        ...(beat.alternates?.length ? { alternates: beat.alternates } : {}),
        ...(short > 1 ? { count: short } : {}),
        objective: LINES.fetch,
        hint: beat.objective,
      },
      where,
    )
    const out = state.clone()
    out.add(pool, short)
    return out
  }

  /** Puts the walk's companion beside the player, since a beat that walks somebody somewhere never asked them along. */
  #alongside(beat: Extract<PlainBeat, { kind: 'escort' }>, where: string, held: Held): Held {
    this.#lead(
      {
        kind: 'talk',
        npcId: beat.npcId,
        effects: [{ kind: 'companion-join', npcId: beat.npcId }],
        objective: LINES.recruit,
        hint: beat.objective,
      },
      where,
    )
    const out = held.clone()
    out.addCompanion(beat.npcId)
    return out
  }

  /** A fork: each road runs its own beats, and they all lead on to whatever comes after the fork. */
  #fork(beat: Extract<Beat, { kind: 'choice' }>, held: Held, where: string): Held {
    const options: { id: string; label: string; next: string }[] = []
    this.#place({ kind: 'choice', prompt: beat.prompt, objective: beat.objective, options }, where)

    const exits: Link[] = []
    const states: Held[] = []
    beat.options.forEach((road, index) => {
      const option = { id: `road_${index + 1}`, label: road.label, next: '' }
      options.push(option)
      this.#open = [(id) => (option.next = id)]
      states.push(this.#segment(road.beats, held.clone(), `${where}.options.${index}.beats`))
      exits.push(...this.#open)
    })
    this.#open = exits
    // one road is taken, so only what every road promises still counts
    return Held.merge(states, 'any')
  }

  /** Puts a step down and leaves its `next` open for whatever comes after it. */
  #lead(body: Record<string, unknown>, where: string): void {
    const step = this.#place({ ...body, next: [] }, where)
    const next = step['next'] as string[]
    this.#open = [(id) => next.push(id)]
  }

  /** Puts a step down, wires whatever was waiting into it, and leaves nothing open. */
  #place(body: Record<string, unknown>, where: string): StepDraft {
    const step = { ...body, ...this.#marker(body), id: stepId(this.#steps.length + 1) } as StepDraft
    for (const link of this.#open) link(step.id)
    this.#open = []
    this.#steps.push(step)
    this.#beatOf.set(step.id, where)
    return step
  }

  /**
   * The name to write beside this step's marker, read off the city it is being
   * compiled against. A body carries a step's own fields under a step's own
   * names, so the exhaustive switch that says what a finished step points at
   * answers it for one still being built.
   */
  #marker(body: Record<string, unknown>): { markerLabel?: string } {
    const label = markerLabel(body as unknown as Step, this.#world)
    return label ? { markerLabel: label } : {}
  }

  /** What the validator refused, said about the beats it was written from. */
  #translate(error: QuestError): BeatProblem[] {
    if (error.code === 'broken-flow') {
      return error.problems.map((problem) => ({
        where: this.#beatOf.get(problem.where) ?? problem.where,
        message: problem.message,
      }))
    }
    return error.violations.map((violation) => ({ where: this.#atStep(violation.path), message: violation.message }))
  }

  /** `steps.3.npcId` said about the beat that step came from; anything else as it stands. */
  #atStep(path: string): string {
    const found = /^steps\.(\d+)(.*)$/.exec(path)
    if (!found) return path
    const id = this.#steps[Number(found[1])]?.id
    const beat = id === undefined ? undefined : this.#beatOf.get(id)
    return beat === undefined ? path : `${beat}${found[2] ?? ''}`
  }
}

/** Whether this beat puts something from the pool, and nothing outside it, into the player's hands. */
function picksUp(beat: PlainBeat, pool: ReadonlySet<string>): boolean {
  if (beat.kind !== 'collect' && beat.kind !== 'buy') return false
  const own = beatPool(beat)
  if (own.size === 0) return false
  for (const itemId of own) if (!pool.has(itemId)) return false
  return true
}

/** What the player is sure to be holding once this beat is done. */
function carried(beat: PlainBeat, held: Held): Held {
  const out = held.clone()
  if (beat.kind === 'collect' || beat.kind === 'buy') out.add(beatPool(beat), beatCount(beat))
  if (beat.kind === 'deliver' || beat.kind === 'stash') out.consume(beatPool(beat), beatCount(beat))
  if (beat.kind === 'talk') {
    for (const handed of beat.hands ?? []) if (handed.kind === 'give-item') out.add(new Set([handed.itemId]), 1)
  }
  return out
}

/** How many of a pool a beat is about, written out only where it is more than one. */
function pool(beat: Carrying): Record<string, unknown> {
  return {
    ...(beat.alternates?.length ? { alternates: beat.alternates } : {}),
    ...(beat.count && beat.count > 1 ? { count: beat.count } : {}),
  }
}

/** The step one beat becomes, without the edges: those are the compiler's. */
function stepFor(beat: PlainBeat): Record<string, unknown> {
  const objective = beat.objective
  switch (beat.kind) {
    case 'talk':
      return {
        kind: 'talk',
        npcId: beat.npcId,
        ...(beat.topic ? { topic: beat.topic } : {}),
        ...(beat.hands?.length ? { effects: beat.hands } : {}),
        objective,
      }
    case 'goto':
      return { kind: 'goto', place: beat.where, objective }
    case 'collect':
      return { kind: 'collect', itemId: beat.itemId, ...pool(beat), ...(beat.allowSteal ? { allowSteal: true } : {}), objective }
    case 'buy':
      return { kind: 'buy', itemId: beat.itemId, ...pool(beat), objective }
    case 'deliver':
      return { kind: 'deliver', itemId: beat.itemId, toNpcId: beat.toNpcId, ...pool(beat), objective }
    case 'stash':
      return { kind: 'stash', itemId: beat.itemId, interiorId: beat.interiorId, anchorId: beat.anchorId, ...pool(beat), objective }
    case 'escort':
      return { kind: 'escort', npcId: beat.npcId, place: beat.where, objective }
    case 'unlock':
      return { kind: 'unlock', doorId: beat.doorId, objective }
    case 'hack':
      return { kind: 'hack', machineId: beat.machineId, objective }
    case 'beat-game':
      return { kind: 'beat-game', machineId: beat.machineId, score: beat.score, objective }
  }
}

function stepId(position: number): string {
  return `step_${String(position).padStart(4, '0')}`
}
