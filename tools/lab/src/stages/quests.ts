/**
 * Stage 4: the quests.
 *
 * One forced call per quest, each shown one corner of the city and nothing
 * else. The tool is the quest draft contract put through three passes: cut to
 * what a summary can name, pinned to that corner's own ids, and hoisted so
 * nothing repeats. All three are done live here, off the same functions the
 * build calls, so the sizes on the page are the sizes on the wire.
 */
import type { WorldSummary } from '@gb/forge'
import { DIFFICULTIES, questDraftContract, REWARD_TABLE } from '@gb/quest'
import { idsOf, Neighbourhood } from '../../../../game/scribe/src/neighbourhood.ts'
import { compactSchema } from '../../../../game/scribe/src/schema/compact.ts'
import { pinToCorner } from '../../../../game/scribe/src/schema/corner.ts'
import { narrowToSummary } from '../../../../game/scribe/src/schema/narrow.ts'
import { CitySummary } from '../../../../game/scribe/src/summary.ts'
import { el, field, json, table } from '../dom.ts'
import { acceptQuest, narratorFor } from '../pipeline.ts'
import type { Json } from '../schema.ts'
import { exchangeViews, sandbox, showProblems, type Call, type Fact, type Lab, type Stage } from '../stage.ts'
import { site } from '../source.ts'

/** How much of the city one quest is shown, the same constant the writer uses. */
const PLACES_PER_QUEST = 8

export const QUESTS: Stage = {
  id: 'quests',
  n: 4,
  title: 'The quests',
  lede:
    'One forced call per quest: the main line first, then each side errand. The work is written over the bare architecture, before a sign is hung, so every id is the one the finished city will carry and every name is a placeholder. The writer is blind to the city as a place. It is shown a corner of it: eight places, what each of them is, who is in them and what is in them, and nothing about geometry. A quest that sends the player across town is entertaining rather than broken (docs/CITY.md section 9), so what the writer needs is which places hang together, not how far apart they are. Every draft is checked here against the ids it was shown, walked the way the harness plays it, then handed to the forge, which validates it again against the real city.',

  calls(lab) {
    const summary = lab.captured.summary
    return [questCall(summary, lab)]
  },

  told: () => TOLD,
  engine: () => ENGINE,
  engineNote: 'settled before the question goes out',
  today: () => TODAY,
  todayNote: 'docs/CITY.md section 9: districts, not metres',

  sandbox(lab) {
    const count = el('input', { type: 'number', class: 'num', min: '0', max: '12', value: String(lab.form.sideQuestCount) }) as HTMLInputElement
    return sandbox(
      lab,
      'write the quests',
      [
        el('p', { class: 'hint' }, 'The input is a real WorldSummary, taken off the narrator port during a build or read straight off a world file. One call per quest: the main line is index 0.'),
        field('Side errands beside the main line', count),
      ],
      async (run, signal) => {
        const summary = lab.captured.summary
        if (!summary) throw new Error('no summary captured: build a city from the header, or load a world file')
        const sideQuests = Number(count.value)
        run.out.appendChild(el('h3', {}, 'The summary the writer is handed'))
        run.out.appendChild(json({ ...summary, places: summary.places }, true))

        const author = narratorFor(lab.author, lab.form, lab.recorder, lab.base, signal)
        const written = await author.writeQuests({ summary, sideQuests })
        run.out.appendChild(el('h3', {}, `The calls (${lab.recorder.exchanges.length})`))
        run.out.appendChild(exchangeViews(lab.recorder.exchanges))
        showProblems(run, author)
        if (!written.ok) {
          run.stopped(written.error)
          return
        }

        const drafts = written.value
        run.out.appendChild(el('h3', {}, `The drafts that came back (${drafts.length})`))
        run.out.appendChild(json(drafts, true))

        const world = lab.captured.world
        run.out.appendChild(el('h3', {}, 'What the forge then does with them'))
        if (!world) {
          run.out.appendChild(el('p', { class: 'hint' }, 'No world in hand, so the forge\'s own check cannot be run. Build a city or load a file to see it.'))
          return
        }
        run.out.appendChild(
          table(
            ['Quest', 'validateQuest against this city', 'Why not'],
            drafts.map((draft) => {
              const verdict = acceptQuest(world, draft)
              const id = (draft as { id?: string }).id ?? '?'
              return [
                id,
                verdict.ok ? 'accepted' : 'rejected',
                verdict.ok ? '' : verdict.problems.map((one) => `${one.where}: ${one.message}`).join('\n'),
              ]
            }),
            () => 'f',
          ),
        )
      },
    )
  },
}

function questCall(summary: WorldSummary | undefined, lab: Lab): Call {
  const full = questDraftContract.jsonSchema() as Json
  const narrowed = narrowToSummary(full)
  const corner = cornerOf(summary, lab)
  const pinned = corner ? pinToCorner(narrowed, corner) : undefined
  const sent = corner ? (compactSchema(pinned!) as Json) : undefined
  const note = corner
    ? `${size(full)} -> narrowed ${size(narrowed)} -> pinned ${size(pinned)} -> hoisted ${size(sent)} characters`
    : `${size(full)} characters as published; the pinned one needs a captured city`

  return {
    tool: 'write_quest',
    what: 'one quest, written about one corner of the city',
    prompts: ['system', 'write-quest', 'quest-role-main', 'quest-role-side', 'asked-tone', 'asked-main-quest', 'asked-side-quests', 'no-history', 'tool-write-quest', 'retry'],
    schema: () => (sent ?? (narrowed as Json)),
    schemaNote: note,
    sites: [
      site('game/scribe/src/quests.ts', 'questTool(idsOf(slice))', 'the call'),
      site('game/scribe/src/tools.ts', 'export const questToolSchema', 'the three passes'),
      site('game/scribe/src/schema/narrow.ts', 'export function narrowToSummary', 'cut to what a summary can name'),
      site('game/scribe/src/schema/corner.ts', 'export function pinToCorner', 'every id turned into this corner\'s own enum'),
      site('game/scribe/src/neighbourhood.ts', 'export class Neighbourhood', 'which eight places'),
      site('game/forge/src/forge.ts', 'this.#narrator.writeQuests({ summary', 'who asks for it'),
      site('game/forge/src/forge.ts', 'validateQuest(candidate, questView(world))', 'what the answer is held to'),
    ],
    returns: [
      { field: 'id, title, summary', marks: ['file', 'screen'], note: 'the id is checked against the slot it was asked for. The title and summary are what the objectives panel and the quests tab read.' },
      { field: 'steps[]', marks: ['file', 'screen'], note: 'sealed, then validated against the real city by `validateQuest(candidate, questView(world))`. A draft that names an id the city does not hold is dropped and the reason is kept.' },
      { field: 'reward', marks: ['file'], note: 'credits, things, access, a car, a home. The tier is not asked for at all: `tier.ts` reads the lowest band that allows what the reward hands over.' },
      { field: 'difficulty', marks: ['dropped'], note: 'not in the tool. It is computed from the reward afterwards, because ten measured drafts named a tier and then paid outside it five times.' },
      { field: 'hidden, reveal, pay, stash steps, interior targets', marks: ['dropped'], note: 'cut by `narrow.ts` before the schema goes out, so the model cannot write them at all. A summary cannot name an anchor, so a step that stashes something has nowhere to point.' },
    ],
    checks: [
      { text: 'The quest is not the one the slot asked for: the id is quoted back.', at: site('game/scribe/src/quests.ts', "this quest's id is", 'checked here') },
      { text: 'The flow does not hold up: `@gb/quest`\'s own validator runs here first, against the same ids the model was shown.', at: site('game/scribe/src/quests.ts', 'validateQuest(sealQuest(draft), city.view())', 'checked here') },
      { text: 'The harness could not play it: the giver behind a lock, a thing named before its door opens, a hack on an open screen, a buy of something nobody sells, a bill no `money-at-least` covers.', at: site('game/scribe/src/reach.ts', 'export function reachProblems', 'walked here') },
    ],
  }
}

function cornerOf(summary: WorldSummary | undefined, lab: Lab): ReturnType<typeof idsOf> | undefined {
  if (!summary) return undefined
  const city = new CitySummary(summary)
  const peopled = city.peopled()
  if (!peopled.length) return undefined
  return idsOf(new Neighbourhood(peopled, lab.form.seed).for(0, PLACES_PER_QUEST))
}

const size = (schema: unknown): string => JSON.stringify(schema).length.toLocaleString('en')

const TOLD: readonly Fact[] = [
  { text: 'The city\'s name, its theme, and the town\'s whole history: what it lives on, what happened, what is at stake, who is arguing and what everybody knows.', at: site('game/scribe/src/quests.ts', 'premise: city.history', '') },
  { text: 'Eight places of the city, and only eight. For each: what kind of place it is, its people with their roles and where they stand, its things with seller and price, its locked doors with the key and whose pocket it is in, its screens with what each runs, and what it sells for.', at: site('game/scribe/src/place-lines.ts', 'export function placeLines', '') },
  { text: 'Every id is the id the finished city will carry and every name is a placeholder: the work is written before a sign is hung, so a slot reads `Instance 3` and `Person 8`. The names go up afterwards, over the same ids.', at: site('game/forge/src/forge.ts', '// 3. the work, over the bare architecture', '') },
  { text: 'What each tier of job is allowed to pay, so the reward is written inside a band instead of named and then broken.', at: site('game/scribe/src/reward-bands.ts', 'export function rewardBands', '') },
  { text: 'Whether this slot is the main line or side errand n of m, and what the owner asked of that slot.', at: site('game/scribe/src/quests.ts', "prompt('quest-role-main'", '') },
  { text: 'The titles already used, so two quests in one town are not called the same thing.', at: site('game/scribe/src/quests.ts', 'usedTitles: bullets(', '') },
  { text: 'Nothing about the grid, the streets, the blocks, a room or a plot\'s size. The only geometry that reaches it at all is the walk between two doors, below.', at: site('game/forge/src/narrator.ts', 'The abstract world a quest writer sees', '') },
]

const ENGINE: readonly Fact[] = [
  { text: 'Which eight places the writer sees: a seeded home and the places that hang together with it, with about one in five swapping its furthest neighbour for the far side of town so a town is not made entirely of errands you could run in a minute.', at: site('game/scribe/src/neighbourhood.ts', 'export class Neighbourhood', '') },
  { text: 'The quest id: `quest_0001` and up, by slot, so a growth carries on from the last one rather than colliding with it.', at: site('game/scribe/src/quests.ts', 'function questId', '') },
  { text: 'How much work a town holds at all.', at: site('game/forge/src/quests/demand.ts', 'export function questDemand', '') },
  { text: 'What each tier is allowed to pay, and which tier a quest ends up in: the model writes the pay, `tier.ts` reads the tier off it.', at: site('game/quest/src/balance.ts', 'export const REWARD_TABLE', ''), values: DIFFICULTIES.map((tier) => `${tier}: ${REWARD_TABLE[tier].money.min} to ${REWARD_TABLE[tier].money.max} credits`) },
  { text: 'Which step kinds are offered at all. A corner with no locked screen is not shown `hack`; one with nothing on a counter is not shown `buy`.', at: site('game/scribe/src/schema/corner.ts', 'export function pinToCorner', '') },
  { text: 'Whether the draft is playable: the flow check refuses a dead end, an unreachable step and a quest that cannot complete.', at: site('game/quest/src/validate.ts', 'export function checkFlow', '') },
  { text: 'A slot the model will not fill stops the stage. Nothing is composed in its place, so the build has no city rather than a town half somebody\'s.', at: site('game/forge/src/forge.ts', 'if (!written.ok) return err(stopped(written.error))', '') },
]

/**
 * `docs/CITY.md` section 9: the quest writer should be told the district a slot
 * is in and nothing finer, because coordinates and metres make it careful about
 * geography and careless about the story. Today it is handed metres.
 */
const TODAY: readonly Fact[] = [
  { text: 'Every place in the summary carries its street door in metres, put there by the forge.', at: site('game/forge/src/summary.ts', 'door: cellCentre(', '') },
  { text: 'The corner is cut by nearness measured off those doors, and the walk to each neighbour goes into the prompt as a number of metres.', at: site('game/scribe/src/neighbourhood.ts', 'export function walk', '') },
  { text: 'The coarse handle exists in the summary (the parts of the town, and the part each place stands in) and the corner is still cut by metres rather than by it.', at: site('game/forge/src/summary.ts', 'districtId', '') },
]
