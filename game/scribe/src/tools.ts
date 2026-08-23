import { contract, type Contract } from '@gb/kit'
import { questDraftContract } from '@gb/quest'
import { z } from 'zod'
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

/** The quest tool's parameters: the draft contract, cut to what a summary can name and written without repeats. */
export const questToolSchema = (): JsonSchema =>
  compactSchema(narrowToSummary(questDraftContract.jsonSchema() as JsonSchema))

export const WRITE_QUEST: Tool<QuestDraft> = {
  name: 'write_quest',
  description: prompt('tool-write-quest'),
  contract: new ToolContract(questDraftContract, questToolSchema()),
}
