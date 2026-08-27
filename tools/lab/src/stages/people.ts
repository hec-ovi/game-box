/**
 * Stage 3: the people.
 *
 * There is no separate people call on the path a build actually takes: a person
 * is written inside their building, as part of `write_instance`, because who
 * staffs a clinic and what they cover for each other is one decision. So this
 * stage shows that call's `people[]` sub-schema as the person tool it is, and
 * beside it the single-person tool `describe_npc`, which is the same shape
 * asked one at a time and is what a narrator without `writeInstances` gets.
 */
import { BACKGROUND_UNLOCKS, BODY_KINDS, MAX_BACKGROUND_FACTS, NPC_ROLES } from '@gb/world'
import { describeNpcTool, instanceTool } from '../../../../game/scribe/src/tools.ts'
import { el, field, json, pre } from '../dom.ts'
import { narratorFor } from '../pipeline.ts'
import type { Json } from '../schema.ts'
import { exchangeViews, sandbox, showProblems, type Call, type Fact, type Lab, type Stage } from '../stage.ts'
import { site } from '../source.ts'

const LETTERS = 'ABCD'

export const PEOPLE: Stage = {
  id: 'people',
  n: 3,
  title: 'The people',
  lede:
    'Who stands at each post, their name, their life and what they know. On the path a build takes this is not a call of its own: it is the `people[]` array of stage 2, so a place\'s staff are written together. The single-person tool below is the same person schema asked one at a time, and it is what runs when a narrator offers no whole-place call. Either way, the job, the post, the room, the body and the four letters the family name has to start with were all decided before the question went out.',

  calls(lab) {
    const request = lab.captured.instanceRequests?.[0]
    const shell = {
      postIds: request?.posts.map((post) => post.postId) ?? ['anchor_0001'],
      thingIds: request?.things.map((thing) => thing.thingId) ?? [],
      letters: LETTERS,
    }
    return [personInsideAPlace(shell), onePersonAlone()]
  },

  told: () => TOLD,
  engine: () => ENGINE,
  engineNote: 'facts about the post, settled before anybody is written into it',

  sandbox(lab) {
    const choose = el('select') as HTMLSelectElement
    const posts = (lab.captured.instanceRequests ?? []).flatMap((request, place) =>
      request.posts.map((post) => ({ request, post, label: `${place}: the ${post.role} in the ${request.charter.label} (post ${post.postId}, index ${post.index})` })),
    )
    for (const [index, one] of posts.entries()) choose.appendChild(el('option', { value: String(index) }, one.label))
    if (!posts.length) choose.appendChild(el('option', { value: '' }, 'nothing captured yet'))

    return sandbox(
      lab,
      'write one person',
      [
        el('p', { class: 'hint' }, 'Runs describeNpc: the single-person tool, with the role, the place and its charter that the forge would hand it. Capture a city from the header or stage 1 to fill this list.'),
        field('The post to fill', choose),
      ],
      async (run, signal) => {
        const chosen = posts[Number(choose.value)]
        if (!chosen) throw new Error('no post captured: build a city from the header first')
        const { request, post } = chosen
        const cast = request.cast.filter((one) => one.postId === post.postId)
        const input = {
          role: post.role,
          placeKind: request.kind,
          place: request.charter,
          placeName: request.name,
          theme: request.theme,
          index: post.index,
          ...(request.premise === undefined ? {} : { premise: request.premise }),
          ...(cast.length ? { cast } : {}),
        }
        run.out.appendChild(el('h3', {}, 'The input'))
        run.out.appendChild(json(input))

        const author = narratorFor(lab.author, lab.form, lab.recorder, lab.base, signal)
        const written = await author.describeNpc(input)
        run.out.appendChild(el('h3', {}, `The call (${lab.recorder.exchanges.length})`))
        run.out.appendChild(exchangeViews(lab.recorder.exchanges))
        showProblems(run, author)
        if (!written.ok) {
          run.stopped(written.error)
          return
        }

        const person = written.value
        run.out.appendChild(el('h3', {}, 'The validated person'))
        run.out.appendChild(json(person, true))
        const stages = new Set((person.background ?? []).map((fact) => fact.unlockedBy))
        run.out.appendChild(
          pre(
            [
              `name: ${person.name}`,
              `life: ${person.life ? `${Object.keys(person.life).length} of 7 fields written` : 'none, so this person answers off personality and knowledge alone'}`,
              `codex: ${person.background?.length ?? 0} facts covering ${[...stages].join(', ') || 'nothing'}`,
              `the four unlocks the codex has to cover: ${BACKGROUND_UNLOCKS.join(', ')}`,
            ].join('\n'),
          ),
        )
      },
    )
  },
}

function personInsideAPlace(shell: { postIds: readonly string[]; thingIds: readonly string[]; letters: string }): Call {
  return {
    tool: 'write_instance -> people[]',
    what: 'the people of one place, written with the place, on the path a build takes',
    prompts: ['system', 'write-instance', 'tool-write-instance'],
    schema: () => peopleSchemaOf(instanceTool(shell).contract.jsonSchema() as Json),
    schemaNote: 'the `people` array of the whole-place tool, which is `personSchema(letters)`',
    sites: [
      site('game/scribe/src/person.ts', 'export function personSchema', 'the one person shape'),
      site('game/scribe/src/tools.ts', '...personSchema(shell.letters).shape', 'how it is folded into the place tool'),
      site('game/scribe/src/claim.ts', 'export function familyPattern', 'the letters the family name is held to'),
    ],
    returns: [
      { field: 'given, family', marks: ['file', 'screen'], note: '`profileOf` joins them into `npc.name`. Two people can only collide if their family names do, and each place holds four letters nobody near it holds.' },
      { field: 'personality', marks: ['file', 'prompt'], note: 'how they behave when a stranger walks in. @gb/talk builds the conversation brief from it.' },
      { field: 'knowledge[]', marks: ['file', 'prompt'], note: 'two to four things they could have picked up from where they stand. Also the conversation brief.' },
      { field: 'life.reason', marks: ['file', 'prompt'], note: 'why they are at this spot, first person. What the person says at their post.' },
      { field: 'life.errand', marks: ['file', 'prompt'], note: 'what they are doing out walking, first person, naming no place. Written so somebody who has left their post has a line that is not about the counter.' },
      { field: 'life.history, interests, manner, cares, avoids', marks: ['file', 'prompt'], note: 'the rest of a life, all required. This is what makes two people in one room answer differently.' },
      { field: 'background[]', marks: ['file', 'screen'], note: 'the codex the player earns, four facts at least, one behind each of `met`, `talked`, `quest` and `told`.' },
    ],
    checks: [
      { text: `A codex that leaves one of ${BACKGROUND_UNLOCKS.join(', ')} with no fact behind it: the next attempt is told which stage is empty.`, at: site('game/scribe/src/person.ts', 'no fact is unlocked by', 'refused here') },
      { text: 'A name the city has already spent, or a near miss of one. The lower index keeps it.', at: site('game/scribe/src/registry.ts', 'export class NameRegistry', 'kept here') },
    ],
  }
}

function onePersonAlone(): Call {
  return {
    tool: 'describe_npc',
    what: 'one person on their own, for a narrator that writes no whole places',
    prompts: ['system', 'describe-npc', 'charter', 'no-history', 'tool-describe-npc', 'retry'],
    schema: () => describeNpcTool(LETTERS).contract.jsonSchema() as Json,
    schemaNote: `pinned to the four letters this index was dealt (shown for ${LETTERS})`,
    sites: [
      site('game/scribe/src/scribe.ts', 'describeNpcTool(letters)', 'the call'),
      site('game/scribe/src/tools.ts', 'export function describeNpcTool', 'the tool'),
      site('game/forge/src/narrator/one-at-a-time.ts', 'describeNpc(', 'the path that uses it'),
    ],
    returns: [
      { field: 'the same person shape', marks: ['file'], note: 'exactly `personSchema`, so a narrator asked one at a time gives a person the world accepts on the same terms.' },
    ],
  }
}

/** The `people` array of the whole-place schema, on its own. */
function peopleSchemaOf(schema: Json): Json | undefined {
  const properties = schema['properties'] as Record<string, Json> | undefined
  const people = properties?.['people']
  return (people?.['items'] as Json | undefined) ?? people
}

const TOLD: readonly Fact[] = [
  { text: 'The job they do, and what kind of place they do it in, as the charter reads in plain words.', at: site('game/scribe/src/scribe.ts', 'role: input.role', '') },
  { text: 'The name of the place they stand in, hung over its door before anybody was written into it, the city\'s name and its theme.', at: site('game/scribe/src/scribe.ts', 'placeName: input.placeName', '') },
  { text: 'Which quest needs somebody at this post, in what part and with what line, is on the input; the describe-npc prompt renders none of it. A person asked for one at a time is handed the same cast the whole-place call gets.', at: site('game/forge/src/narrator/one-at-a-time.ts', 'const cast = request.cast.filter', '') },
  { text: 'The town\'s whole history, so what they know is about this town and could not have been said in another.', at: site('game/scribe/src/scribe.ts', "prompt('describe-npc', {", '') },
  { text: 'The four letters their family name may start with, and every name the city has already spent.', at: site('game/scribe/src/scribe.ts', 'letters: letters.split', '') },
  { text: 'Nothing about where the post is. No room size, no metres, no coordinates and no body: a person is written from their job and their town.' },
]

const ENGINE: readonly Fact[] = [
  { text: 'Whether there is a person here at all: an anchor gets a post only if the charter gives that kind of post a job.', at: site('game/forge/src/populate.ts', 'export function roleFor', '') },
  { text: 'What that job is. The role is handed to the model, never chosen by it:', at: site('game/world/src/model/vocabulary.ts', 'export const NPC_ROLES', ''), values: [...NPC_ROLES] },
  { text: 'Which post in which room they stand at, and therefore what they are doing all day.', at: site('game/forge/src/raise/plan.ts', 'posts.push({ npcId: world.mintId', '') },
  { text: 'What body they get and which variant of it:', at: site('game/world/src/model/vocabulary.ts', 'export const BODY_KINDS', ''), values: [...BODY_KINDS] },
  { text: 'Which four letters their family name may start with, dealt four at a time off a shuffle of the alphabet so any six places in a row hold disjoint letters.', at: site('game/scribe/src/claim.ts', 'export class FamilyClaims', '') },
  { text: 'Their number in the town, which is what their seed and their letters are drawn from.', at: site('game/forge/src/raise/plan.ts', 'const index = counts.npcs++', '') },
  { text: `How many facts a codex may hold: at least one for each of ${BACKGROUND_UNLOCKS.join(', ')}, at most ${MAX_BACKGROUND_FACTS}.`, at: site('game/world/src/model/life.ts', 'export const MAX_BACKGROUND_FACTS', '') },
  { text: 'Who carries the key to the locked room. The model is told who keeps the place; it does not decide whose pocket it is in.', at: site('game/forge/src/populate.ts', 'export function keeperOf', '') },
  { text: 'Whether anybody is outdoors. Nobody is: every person is filtered by their station, so a person with no post appears in no summary and no quest can name them.', at: site('game/forge/src/summary.ts', 'npc.station?.interiorId === interior.id', '') },
]
