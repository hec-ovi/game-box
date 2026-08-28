/**
 * Stage 2: the instances.
 *
 * An instance is another dimension (docs/CITY.md section 9): a door on the
 * street, and behind it a space of its own with as many rooms as the place
 * needs. So the call is told what the place is, who is inside it and what is in
 * it, and inside that it is free. What the engine settles beforehand is the
 * facts about the building nobody would want a model guessing at: which posts
 * exist and what job stands at each, what kind of thing is lying about, which
 * room is behind a lock and what opens it, and every id. The call is shown its
 * own building and no other.
 */
import { ANCHOR_KINDS, ITEM_ARCHETYPES, MACHINE_PROGRAMS, METRICS, NPC_ROLES, PROP_SPECS, ROOM_KINDS } from '@gb/world'
import { instanceTool } from '../../../../game/scribe/src/tools.ts'
import { el, field, json, pre } from '../dom.ts'
import { narratorFor } from '../pipeline.ts'
import type { Json } from '../schema.ts'
import { exchangeViews, sandbox, showProblems, type Call, type Fact, type Lab, type Stage } from '../stage.ts'
import { site } from '../source.ts'

export const INSTANCES: Stage = {
  id: 'instances',
  n: 2,
  title: 'The instances',
  lede:
    'One forced call per place that opens, all of them in the air at once, each blind to the others, and last of the build. An instance is its own space: a door on the street, and behind it as many rooms as the place needs (docs/CITY.md section 9). By the time this call goes out the sign is already over the door and the work already names who has to be standing inside, both of them on the request. What the call is told is what the place is, who is inside it and what is in it, and what it hands back is the place written, its people and its stock. Nothing here is a size it has to fit.',

  calls(lab) {
    const request = pick(lab)
    const shell = {
      postIds: request?.posts.map((post) => post.postId) ?? ['anchor_0001', 'anchor_0002'],
      thingIds: request?.things.map((thing) => thing.thingId) ?? ['interior_0001/thing/0'],
      letters: 'ABCD',
    }
    return [
      {
        tool: 'write_instance',
        what: request ? `one whole place (pinned to ${request.charter.label}, ${shell.postIds.length} posts, ${shell.thingIds.length} things)` : 'one whole place, pinned to its own shell',
        prompts: ['system', 'write-instance', 'charter', 'plain-place', 'no-history', 'tool-write-instance', 'retry'],
        schema: () => instanceTool(shell).contract.jsonSchema() as Json,
        schemaNote: request
          ? `pinned to this building's own post and thing ids`
          : 'no place captured yet: shown with placeholder ids, the shape is the same',
        sites: [
          site('game/scribe/src/instance.ts', 'instanceTool(shell)', 'the call'),
          site('game/scribe/src/tools.ts', 'export function instanceTool', 'the tool'),
          site('game/forge/src/forge.ts', 'this.#narrator.writeInstances?.', 'who asks for it'),
          site('game/forge/src/raise/plan.ts', 'export function instanceRequests', 'where the request is built'),
          site('game/forge/src/raise/plan.ts', 'function briefOf', 'the lock, screen and sale brief'),
          site('game/scribe/src/brief-lines.ts', 'export function briefLines', 'how that brief is worded to the model'),
        ],
        returns: [
          { field: 'name', marks: ['dropped'], note: 'still in the tool, and nothing reads it. The sign hung before this call is what the building keeps: `assemble.ts` builds its `PlaceNames` off `one.sign` and never looks at what came back here.' },
          { field: 'character', marks: ['file', 'screen'], note: 'what the place is. Written to `@gb/world`\'s `Interior.description` by `assemble.ts`, so it is in the file and under the place\'s name in the codex. The one-place-at-a-time path writes none, and the interior carries no field at all.' },
          { field: 'people[].postId', marks: ['shape'], note: 'the caller\'s own anchor id, handed out and handed back, so a person is zipped onto a post by id and never by position.' },
          { field: 'people[].given, people[].family', marks: ['file', 'screen'], note: 'joined into `npc.name`. The family name can only start with the four letters this place was dealt, because the schema will not decode anything else.' },
          { field: 'people[].personality, knowledge, life, background', marks: ['file'], note: 'stage 3. Straight into the world file and read by @gb/talk at play time.' },
          { field: 'things[].thingId', marks: ['shape'], note: 'the caller\'s handle again.' },
          { field: 'things[].name, description', marks: ['file', 'screen'], note: '`item.name` and its description: what the player picks up and reads in the inventory.' },
        ],
        checks: [
          { text: 'A post written twice or missed, and a thing written twice or missed.', at: site('game/scribe/src/instance.ts', 'function problemsWith', 'checked here') },
          { text: 'Two people in one building with the same family name, or two things with the same name.', at: site('game/scribe/src/instance.ts', 'is already a family name in this building', 'checked here') },
          { text: 'A person whose codex leaves one of the four unlocks empty.', at: site('game/scribe/src/person.ts', 'export function personProblems', 'checked here') },
          { text: 'A name the city has already spent: the lower index keeps it, and the higher one is asked again with the taken names quoted.', at: site('game/scribe/src/unique.ts', 'export class UniqueNames', 'settled here') },
        ],
      },
    ]
  },

  told: () => TOLD,
  engine: () => ENGINE,
  engineNote: 'facts about the building, not sizes the writer is held to',
  today: () => TODAY,
  todayNote: 'docs/CITY.md section 9: an instance carries no proportion to the city',

  sandbox(lab) {
    const choose = el('select') as HTMLSelectElement
    const requests = lab.captured.instanceRequests ?? []
    for (const [index, request] of requests.entries()) {
      choose.appendChild(el('option', { value: String(index) }, `${index}: ${request.charter.label} (${request.posts.length} posts, ${request.things.length} things, ${request.rooms.length} rooms)`))
    }
    if (!requests.length) choose.appendChild(el('option', { value: '' }, 'nothing captured yet'))

    return sandbox(
      lab,
      'write one place',
      [
        el('p', { class: 'hint' }, 'The input is a real InstanceRequest, taken off the narrator port during a Forge.build. Capture one from the header or from stage 1.'),
        field('The place to write', choose),
      ],
      async (run, signal) => {
        const request = requests[Number(choose.value)]
        if (!request) throw new Error('no place captured: build a city from the header first')
        run.out.appendChild(el('h3', {}, 'The request the forge hands the narrator'))
        run.out.appendChild(json(request, true))

        const author = narratorFor(lab.form, lab.recorder, lab.base, signal)
        if (!author.writeInstances) throw new Error('the scribe offers no writeInstances, so a place is written one question at a time')
        const written = await author.writeInstances([request])
        run.out.appendChild(el('h3', {}, `The call (${lab.recorder.exchanges.length})`))
        run.out.appendChild(exchangeViews(lab.recorder.exchanges))
        showProblems(run, author)
        if (!written.ok) {
          run.stopped(written.error)
          return
        }

        const place = written.value[0]
        run.out.appendChild(el('h3', {}, 'The validated place'))
        run.out.appendChild(json(place, true))
        run.out.appendChild(
          pre(
            [
              `posts asked for: ${request.posts.length}, people written: ${place?.people.length ?? 0}`,
              `cast the work asked for: ${request.cast.length}`,
              `things asked for: ${request.things.length}, things named: ${place?.things.length ?? 0}`,
              `character: ${place?.character ? `${place.character.length} characters` : 'none written'}`,
            ].join('\n'),
          ),
        )
      },
    )
  },
}

function pick(lab: Lab) {
  return lab.captured.instanceRequests?.[0]
}

const TOLD: readonly Fact[] = [
  { text: 'What kind of place it is, as its charter reads in plain words: the post at the front, the work done here, what it keeps, who gets in, its rooms, what people say of such places.', at: site('game/scribe/src/charter-lines.ts', 'export function charterLines', '') },
  { text: 'The name already hung over its door is on the request, and the prompt does not render it: the model is asked for a name of its own, and the sign that went up before this call is what the building keeps.', at: site('game/forge/src/raise/plan.ts', 'name: one.sign', '') },
  { text: 'The cast the work asked for is on the request too, and the prompt does not render it: which post a quest needs somebody standing at, in what part, which quest it is and the line the player reads there, all read back off the quests\' own steps.', at: site('game/forge/src/quests/casting.ts', 'export function castOf', '') },
  { text: 'The city\'s name, its theme, and the town\'s whole history.', at: site('game/scribe/src/instance.ts', 'cityName: this.#registry.cityName', '') },
  { text: 'The rooms the shell was cut into, by kind and by nothing else. No metres, no plan, no positions.', at: site('game/forge/src/raise/plan.ts', 'rooms: one.inside.plan.rooms.map', '') },
  { text: 'One post per person to write, each with the job that stands at it and an id to answer under.', at: site('game/forge/src/raise/plan.ts', 'posts: one.inside.posts.map', '') },
  { text: 'The things lying about, each by what it physically is and an id to answer under.', at: site('game/forge/src/raise/plan.ts', 'things: one.inside.things.filter', '') },
  { text: 'What the plan put in the place: a room behind a lock and whether a key, a card or a code opens it, the screens by room and what each runs, whether a camera watches the door, and the price if it is for sale. The code itself is never handed over: the prompt asks who holds the key, never what it is.', at: site('game/scribe/src/brief-lines.ts', 'export function briefLines', '') },
  { text: 'The four letters its family names must start with, and the names the city has already spent.', at: site('game/scribe/src/instance.ts', 'letters: shell.letters', '') },
  { text: 'Nothing about any other building. That is exactly what lets a whole city\'s places be written at once.', at: site('game/scribe/src/instance.ts', 'that call is shown its own building', '') },
]

const ENGINE: readonly Fact[] = [
  { text: 'Whether there is anybody here at all, and what job stands at each post. The role is a fact about the building and is handed over, never asked for:', at: site('game/forge/src/populate.ts', 'export function roleFor', ''), values: [...NPC_ROLES] },
  { text: 'Where a person may stand:', at: site('game/world/src/model/vocabulary.ts', 'export const ANCHOR_KINDS', ''), values: [...ANCHOR_KINDS] },
  { text: 'What kind of thing is lying about. The model names it and says what the city has done to it; what it physically is was already settled:', at: site('game/forge/src/populate.ts', 'export function itemsFor', ''), values: [...ITEM_ARCHETYPES] },
  { text: 'Which room is behind a lock, whether a key, a card or a code opens it, and whose pocket the key is in. The code is the engine\'s and a quest hands it out.', at: site('game/forge/src/interior/locks.ts', 'export function lockDoors', '') },
  { text: 'What runs on each screen:', at: site('game/world/src/model/machine.ts', 'export const MACHINE_PROGRAMS', ''), values: [...MACHINE_PROGRAMS] },
  { text: 'Every id: the post ids, the key ids and the thing ids, made out of the interior id and a counter and handed over to be answered under.', at: site('game/forge/src/raise/plan.ts', '/key/', '') },
  { text: 'What each person looks like. The body and its variant are drawn from the seed, and appearance is in no tool.', at: site('game/forge/src/raise/plan.ts', 'appearance: { base: bodyFor(rng)', '') },
  { text: 'The price of the home the town puts on the market, and of everything on a counter.', at: site('game/forge/src/prices.ts', 'export function priceOf', '') },
  { text: `Which rooms the shell was cut as, off the charter's own list of rooms. The model is told the kinds, never the plan: ${ROOM_KINDS.length} kinds exist.`, at: site('game/forge/src/interior/plan.ts', 'export function planInterior', ''), values: [...ROOM_KINDS] },
]

/**
 * Today's code also cuts the shell to the plot and draws the furniture to the
 * metre. `docs/CITY.md` section 9 says an instance is another dimension and
 * carries no proportion to the city, so none of this is a rule the writer is
 * held to; whether an interior is ever held to its building's footprint is a
 * later question. It is here because it is true of the code, not because it is
 * a constraint on the answer.
 */
const TODAY: readonly Fact[] = [
  { text: `The shell is cut from the plot's own footprint, less ${METRICS.building.wallThickness} m of wall each side, and the rooms are planned inside that.`, at: site('game/forge/src/raise/plan.ts', 'const size = { w: one.site.rect.w', '') },
  { text: `Every piece of furniture is drawn to a fixed spec: ${Object.keys(PROP_SPECS).length} of them, with footprints and heights the art is built to.`, at: site('game/world/src/props.ts', 'export const PROP_SPECS', '') },
  { text: `Surfaces are held to what a body reaches: a standing palm at ${METRICS.reach.standing.palm} m, a seated one at ${METRICS.reach.seated.palm} m.`, at: site('game/world/src/metrics.ts', 'reach: {', '') },
]
