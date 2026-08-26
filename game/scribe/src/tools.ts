import { contract, type Contract } from '@gb/kit'
import { questDraftContract } from '@gb/quest'
import { CharterSchema, premiseContract, type Charter, type Premise, type Word } from '@gb/world'
import { z } from 'zod'
import { briefDraftContract, type BriefDraft } from './brief.ts'
import { personSchema, type WrittenPerson } from './person.ts'
import { prompt } from './prompts.ts'
import { compactSchema, type JsonSchema } from './schema/compact.ts'
import { pinToCorner, type CornerIds } from './schema/corner.ts'
import { narrowToSummary } from './schema/narrow.ts'
import { ToolContract } from './schema/tool-contract.ts'

/** One thing the model can be asked for: the tool's name, what it is for, and the contract its arguments must satisfy. */
export interface Tool<T> {
  readonly name: string
  readonly description: string
  readonly contract: Contract<T>
}

export interface CityName {
  readonly name: string
}
export interface PlaceName {
  readonly name: string
}
export interface Thing {
  readonly name: string
  readonly description: string
}
export type QuestDraft = typeof questDraftContract extends Contract<infer T> ? T : never

/**
 * The brief itself, which is the one call that happens before there is a city
 * at all: somebody at the form asking for a field to be written for them.
 *
 * It answers the form's own five fields and nothing else, so what comes back
 * goes straight into the boxes they are looking at.
 */
export const WRITE_BRIEF: Tool<BriefDraft> = {
  name: 'write_brief',
  description: prompt('tool-write-brief'),
  contract: briefDraftContract,
}

/**
 * The city's history, and the first call of a build.
 *
 * Its parameters are `@gb/world`'s own premise schema, unaltered, so what the
 * model decodes against and what the city accepts cannot drift apart. The
 * order matters as much as the fields: a constrained model writes the
 * properties in the order the schema lists them, and this one lists what the
 * town lives on, what happened and who is arguing before it lists the buildings
 * the town is made of, so the mix is written out of the history rather than
 * before it.
 */
export const WRITE_PREMISE: Tool<Premise> = {
  name: 'write_premise',
  description: prompt('tool-write-premise'),
  contract: premiseContract,
}

/**
 * One kind of place the history invented, as `@gb/world`'s own charter contract
 * with the word pinned: the model decodes against the file's own shape, and it
 * cannot answer a question about a jail with a charter for something else.
 */
export function charterTool(word: Word): Tool<Charter> {
  return {
    name: 'write_charter',
    description: prompt('tool-write-charter'),
    contract: contract('write_charter', CharterSchema.extend({ word: z.literal(word) })),
  }
}

export const NAME_CITY: Tool<CityName> = {
  name: 'name_city',
  description: prompt('tool-name-city'),
  contract: contract('name_city', z.object({ name: z.string().min(2).max(60) })),
}

export const NAME_PLACE: Tool<PlaceName> = {
  name: 'name_place',
  description: prompt('tool-name-place'),
  contract: contract('name_place', z.object({ name: z.string().min(2).max(80) })),
}

export const DESCRIBE_ITEM: Tool<Thing> = {
  name: 'describe_item',
  description: prompt('tool-describe-item'),
  contract: contract(
    'describe_item',
    z.object({ name: z.string().min(2).max(60), description: z.string().min(4).max(300) }),
  ),
}

/** One person, whole: their family name held to the letters their index was dealt. */
export function describeNpcTool(letters: string): Tool<WrittenPerson> {
  return {
    name: 'describe_npc',
    description: prompt('tool-describe-npc'),
    contract: contract('describe_npc', personSchema(letters)),
  }
}

/** The signs over a batch of buildings, each carrying the label it was asked under. */
export interface WrittenSigns {
  readonly signs: readonly { readonly building: string; readonly name: string }[]
}

export function signsTool(labels: readonly string[]): Tool<WrittenSigns> {
  const sign = z.object({ building: oneOf(labels), name: z.string().min(2).max(80) })
  return {
    name: 'name_signs',
    description: prompt('tool-name-signs'),
    contract: contract('name_signs', z.object({ signs: exactly(sign, labels.length) })),
  }
}

/** One place and everybody in it, as one answer. */
export interface WrittenPlace {
  readonly name: string
  readonly character: string
  readonly people: readonly (WrittenPerson & { readonly postId: string })[]
  readonly things: readonly { readonly thingId: string; readonly name: string; readonly description: string }[]
}

/** The shell an instance is written into: the posts to fill, the stock to name, the names it may use. */
export interface Shell {
  readonly postIds: readonly string[]
  readonly thingIds: readonly string[]
  /** The letters this place's family names start with. */
  readonly letters: string
}

/**
 * The tool for one whole place, built around the shell it is written into: the
 * post ids and thing ids are the only ones it can answer with, there is exactly
 * one answer for each of them, and a family name outside the place's own claim
 * cannot be written at all, because the model decodes against this.
 *
 * Every length here is `@gb/world`'s own limit on the field it ends up in, so
 * an answer this accepts is an answer the world accepts. `character` has no
 * limit, because nothing downstream holds it to one: measured, a bar's came
 * back at 430 characters against a 400 cap, and the cap cost the whole place.
 */
export function instanceTool(shell: Shell): Tool<WrittenPlace> {
  const people = z.object({ postId: oneOf(shell.postIds), ...personSchema(shell.letters).shape })
  const things = z.object({
    thingId: oneOf(shell.thingIds),
    name: z.string().min(2).max(60),
    description: z.string().min(4).max(300),
  })
  return {
    name: 'write_instance',
    description: prompt('tool-write-instance'),
    contract: contract(
      'write_instance',
      z.object({
        name: z.string().min(2).max(80),
        character: z.string().min(20),
        people: exactly(people, shell.postIds.length),
        things: exactly(things, shell.thingIds.length),
      }),
    ),
  }
}

/** One of these ids, and nothing else. A shell with no slots still needs a shape for the empty list. */
function oneOf(ids: readonly string[]): z.ZodType<string> {
  return z.enum((ids.length ? ids : ['none']) as [string, ...string[]])
}

/** As many entries as there are slots to fill, which for an empty shell is none. */
function exactly<T>(item: z.ZodType<T>, count: number): z.ZodType<T[]> {
  return count === 0 ? z.array(item).max(0) : z.array(item).length(count)
}

/** The quest tool's parameters: the draft contract, cut to what a summary can name, pinned to the corner's own ids, and written without repeats. */
export const questToolSchema = (corner: CornerIds): JsonSchema =>
  compactSchema(pinToCorner(narrowToSummary(questDraftContract.jsonSchema() as JsonSchema), corner))

/** One quest, written about one corner of the city: the only ids it can decode are that corner's. */
export function questTool(corner: CornerIds): Tool<QuestDraft> {
  return {
    name: 'write_quest',
    description: prompt('tool-write-quest'),
    contract: new ToolContract(questDraftContract, questToolSchema(corner)),
  }
}
