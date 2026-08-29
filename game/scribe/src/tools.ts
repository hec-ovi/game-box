import { contract, type Contract } from '@gb/kit'
import { questSheetContract } from '@gb/quest'
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
export type QuestSheet = typeof questSheetContract extends Contract<infer T> ? T : never

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

/** One thing the town needs behind its doors, as the model is asked to answer it. */
export interface NeedSlot {
  /** The label it answers under. */
  readonly label: string
  /** What the town needs, in the words the caller asked for it. */
  readonly wants: string
  /** How many of the town's doors have to be the kind that answers it. */
  readonly count: number
  /** The word that answers it, where the town's own history named one. */
  readonly kind?: Word | undefined
}

/** The kind of place that answers each of the town's needs, by the label the need was asked under. */
export interface WrittenNeeds {
  readonly needs: Readonly<Record<string, Word>>
}

/**
 * Which kind of place answers each thing the town needs, asked before a door is
 * filled in and before there is a schema for the doors at all.
 *
 * It is one word per need and nothing else: what the town needs is a kind of
 * place, and which doors then hold it is picked from the architecture. Every
 * answer is an enum of the charters the city carries, and a need the town's own
 * history named is pinned to its word, so the model cannot answer "a jail" with
 * anything else.
 */
export function needsTool(needs: readonly NeedSlot[], kinds: readonly Word[]): Tool<WrittenNeeds> {
  const word = oneOf(kinds)
  const answers = Object.fromEntries(
    needs.map((need) => [
      need.label,
      (need.kind ? z.literal(need.kind) : word).describe(
        `The kind of place that answers this: ${need.wants}. The town needs ${need.count} of its open doors to be one.`,
      ),
    ]),
  )
  return {
    name: 'settle_needs',
    description: prompt('tool-settle-needs'),
    contract: contract('settle_needs', z.object({ needs: z.object(answers) }) as unknown as z.ZodType<WrittenNeeds>),
  }
}

/** One of the town's doors as the tool is built around it: the label it is answered under, and the word it is pinned to where a need is answered behind it. */
export interface DoorSlot {
  readonly label: string
  readonly kind?: Word | undefined
}

/** What every open door is, by the label the door was asked under. */
export interface WrittenPlaces {
  readonly places: Readonly<Record<string, Word>>
}

/**
 * What each of the town's open doors is: the stage that decides a city's
 * locations, so it is the one tool that cannot answer a word the city does not
 * declare, and every door is an enum of the charters the city carries.
 *
 * One property per door, under the door's own label, so a building cannot be
 * answered twice or left out and no answer has to be matched back to a label by
 * repeating it. A door one of the town's needs has taken is a constant: the
 * kind was settled before this call and is written back as it stands, which is
 * how a town gets what it needs by construction rather than by counting the
 * answer afterwards. The words repeat down every door, so the enum is hoisted
 * once into `$defs` and the doors point at it.
 */
export function placesTool(doors: readonly DoorSlot[], kinds: readonly Word[]): Tool<WrittenPlaces> {
  const word = oneOf(kinds)
  const places = z.object(Object.fromEntries(doors.map((door) => [door.label, door.kind ? z.literal(door.kind) : word])))
  const source = contract('write_places', z.object({ places }) as unknown as z.ZodType<WrittenPlaces>)
  return {
    name: 'write_places',
    description: prompt('tool-write-places'),
    contract: new ToolContract(source, compactSchema(source.jsonSchema() as JsonSchema)),
  }
}

/** The signs over a batch of buildings, each carrying the label it was asked under, and what the building is where nobody has said yet. */
export interface WrittenSigns {
  readonly signs: readonly { readonly building: string; readonly name: string; readonly kind?: Word }[]
}

/**
 * A batch of signs. `kinds` is the closed list a building nobody has said
 * anything about is written as; a batch of doors whose kinds are already
 * settled is asked for the signs alone, so no call writes a word its caller
 * already has.
 */
export function signsTool(labels: readonly string[], kinds?: readonly Word[]): Tool<WrittenSigns> {
  const name = z.string().min(2).max(80)
  const sign = kinds
    ? z.object({ building: oneOf(labels), kind: oneOf(kinds).describe('What this building is, as one of the words this city declares.'), name })
    : z.object({ building: oneOf(labels), name })
  return {
    name: 'name_signs',
    description: prompt(kinds ? 'tool-name-frontage' : 'tool-name-signs'),
    contract: contract('name_signs', z.object({ signs: exactly(sign, labels.length) }) as unknown as z.ZodType<WrittenSigns>),
  }
}

/** What each part of the city is called, each carrying the label it was asked under. */
export interface WrittenDistricts {
  readonly districts: readonly { readonly district: string; readonly name: string }[]
}

/**
 * The names of the parts of a city, asked for together. Every length is
 * `@gb/world`'s own limit on the field it ends up in, and the fields carry
 * what a district name is, so the shape of the answer is described where the
 * model decodes it rather than only in the prompt.
 */
export function districtsTool(labels: readonly string[]): Tool<WrittenDistricts> {
  const district = z.object({
    district: oneOf(labels).describe('The label of the part of town this name is for, exactly as it was given.'),
    name: z
      .string()
      .min(2)
      .max(40)
      .describe(
        'What people here call that part of town: the name off a road sign, one to three words, built out of what this town lives on or which side of it this part is, and a plain place word (bay, end, row, gate, side, reach). Never the word district, quarter, zone or sector with a number after it, and never a bare compass point.',
      ),
  })
  return {
    name: 'name_districts',
    description: prompt('tool-name-districts'),
    contract: contract('name_districts', z.object({ districts: exactly(district, labels.length) })),
  }
}

/** One place and everybody in it, as one answer. Its name is not in it: the sign over its door was written before this call and is handed in on the request. */
export interface WrittenInstance {
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
export function instanceTool(shell: Shell): Tool<WrittenInstance> {
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

/** The quest tool's parameters: the sheet contract, cut to what a summary can name, pinned to the corner's own ids, and written without repeats. */
export const questToolSchema = (corner: CornerIds): JsonSchema =>
  compactSchema(pinToCorner(narrowToSummary(questSheetContract.jsonSchema() as JsonSchema), corner))

/** One quest as a run of beats, told about one corner of the city: the only ids it can decode are that corner's. */
export function questTool(corner: CornerIds): Tool<QuestSheet> {
  return {
    name: 'write_quest',
    description: prompt('tool-write-quest'),
    contract: new ToolContract(questSheetContract, questToolSchema(corner)),
  }
}
