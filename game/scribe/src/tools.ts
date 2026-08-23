import { contract, type Contract } from '@gb/kit'
import { questDraftContract } from '@gb/quest'
import { z } from 'zod'
import { familyPattern } from './claim.ts'
import { prompt } from './prompts.ts'
import { compactSchema, type JsonSchema } from './schema/compact.ts'
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
export interface Person {
  readonly name: string
  readonly personality: string
  readonly knowledge: readonly string[]
}
export interface Thing {
  readonly name: string
  readonly description: string
}
export type QuestDraft = typeof questDraftContract extends Contract<infer T> ? T : never

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

export const DESCRIBE_NPC: Tool<Person> = {
  name: 'describe_npc',
  description: prompt('tool-describe-npc'),
  contract: contract(
    'describe_npc',
    z.object({
      name: z.string().min(2).max(60),
      personality: z.string().min(10).max(400),
      knowledge: z.array(z.string().min(4).max(300)).min(2).max(4),
    }),
  ),
}

export const DESCRIBE_ITEM: Tool<Thing> = {
  name: 'describe_item',
  description: prompt('tool-describe-item'),
  contract: contract(
    'describe_item',
    z.object({ name: z.string().min(2).max(60), description: z.string().min(4).max(300) }),
  ),
}

/** One place and everybody in it, as one answer. */
export interface Premises {
  readonly name: string
  readonly character: string
  readonly people: readonly {
    readonly postId: string
    readonly given: string
    readonly family: string
    readonly personality: string
    readonly knowledge: readonly string[]
  }[]
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
export function instanceTool(shell: Shell): Tool<Premises> {
  const people = z.object({
    postId: oneOf(shell.postIds),
    given: z.string().min(2).max(30),
    family: z.string().regex(familyPattern(shell.letters)),
    personality: z.string().min(10).max(400),
    knowledge: z.array(z.string().min(4).max(300)).min(2).max(4),
  })
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

/** The quest tool's parameters: the draft contract, cut to what a summary can name and written without repeats. */
export const questToolSchema = (): JsonSchema =>
  compactSchema(narrowToSummary(questDraftContract.jsonSchema() as JsonSchema))

export const WRITE_QUEST: Tool<QuestDraft> = {
  name: 'write_quest',
  description: prompt('tool-write-quest'),
  contract: new ToolContract(questDraftContract, questToolSchema()),
}
