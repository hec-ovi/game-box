/**
 * Stage 1: the city.
 *
 * The history, the kinds of place that history invents, the name over the road
 * sign, and the signs on every door that does not open. Then the grid, the
 * plots and which of them the town spends its doors on, none of which the model
 * is asked about.
 */
import { MOUNTAIN_CELLS } from '@gb/forge'
import { CELL, METRICS, SHIPPED_CHARTERS, type Word } from '@gb/world'
import { charterTool, NAME_CITY, signsTool, WRITE_PREMISE } from '../../../../game/scribe/src/tools.ts'
import { el, field, json, pre } from '../dom.ts'
import { buildCity, narratorFor, premiseInputOf, problemsOf } from '../pipeline.ts'
import type { Json } from '../schema.ts'
import { exchangeViews, sandbox, type Call, type Fact, type Lab, type Stage } from '../stage.ts'
import { site } from '../source.ts'

const PRESET_WORDS = SHIPPED_CHARTERS.map((charter) => charter.word)

export const CITY: Stage = {
  id: 'city',
  n: 1,
  title: 'The city',
  lede:
    'Four forced calls, in this order: the history, one charter for every kind of place the history invented that no preset covers, the city name, and the signs over the doors that do not open, twenty to a call. Between them the forge lays the grid, cuts the plots, rolls a kind onto each one and decides which handful of doors open. None of that is asked.',

  told: () => TOLD,

  calls(lab) {
    const word = (lab.captured.history?.charters?.[0]?.word ?? 'jail') as Word
    const labels = lab.captured.signRequests?.slice(0, 20).map((one) => `b${one.index}`) ?? ['b0', 'b1']
    return [premiseCall(), charterCall(word), nameCityCall(), signsCall(labels)]
  },

  engine: () => ENGINE,
  engineNote: 'arithmetic and closed lists, settled without a question',

  sandbox(lab) {
    const alsoBuild = el('input', { type: 'checkbox' }) as HTMLInputElement
    alsoBuild.checked = true
    return sandbox(
      lab,
      'write the history',
      [
        el('p', { class: 'hint' }, 'Runs writePremise with the brief in the header, then every charter the answer calls for. The city name and the signs follow in the same build.'),
        field('Then build the city offline on this history, to capture the input of stages 2, 3 and 4', alsoBuild),
        el('p', { class: 'hint' }, 'The offline build is the real Forge.build: the room plans, the posts, the locks and the quest summary it makes are what the next stages are handed.'),
      ],
      async (run, signal) => {
        const author = narratorFor(lab.author, lab.form, lab.recorder, lab.base, signal)
        if (!author.writePremise) throw new Error('this author has no writePremise')
        const input = premiseInputOf(lab.form)
        run.out.appendChild(el('h3', {}, 'The input the forge hands it'))
        run.out.appendChild(json(input))

        const history = await author.writePremise(input)
        lab.captured.history = history
        lab.captured.premiseInput = input

        run.out.appendChild(el('h3', {}, `The calls (${lab.recorder.exchanges.length})`))
        run.out.appendChild(exchangeViews(lab.recorder.exchanges))
        run.out.appendChild(el('h3', {}, 'The validated history'))
        run.out.appendChild(json(history, true))

        const problems = problemsOf(author)
        if (problems.length) {
          run.out.appendChild(el('h3', {}, `Rejected along the way (${problems.length})`))
          run.out.appendChild(json(problems, true))
        }

        if (alsoBuild.checked) {
          run.say('building the city offline on that history', 'work')
          const offline = narratorFor('offline', lab.form, lab.recorder, lab.base)
          const outcome = await buildCity(lab.form, offline, history)
          Object.assign(lab.captured, outcome.captured)
          run.out.appendChild(el('h3', {}, `The city, built offline in ${outcome.ms} ms`))
          run.out.appendChild(
            pre(
              outcome.error ??
                [
                  `city: ${outcome.captured.cityName ?? '?'}`,
                  `plots: ${outcome.captured.world?.plots().length ?? 0}`,
                  `places that open: ${outcome.captured.instanceRequests?.length ?? 0}`,
                  `people: ${outcome.captured.world?.npcs().length ?? 0}`,
                  `quests: ${outcome.captured.quests?.length ?? 0}`,
                ].join('\n'),
            ),
          )
          lab.refresh()
        }
      },
    )
  },
}

function premiseCall(): Call {
  return {
    tool: 'write_premise',
    what: 'the town\'s history, and the first call of any build',
    prompts: ['system', 'write-premise', 'asked-brief', 'asked-tone', 'asked-main-quest', 'asked-look', 'asked-nothing', 'tool-write-premise', 'retry'],
    schema: () => WRITE_PREMISE.contract.jsonSchema() as Json,
    schemaNote: '@gb/world premiseContract, unaltered',
    sites: [
      site('game/scribe/src/premise.ts', 'WRITE_PREMISE,', 'the call'),
      site('game/scribe/src/tools.ts', 'contract: premiseContract', 'the tool'),
      site('game/forge/src/forge.ts', 'this.#narrator.writePremise?.', 'who asks for it'),
      site('game/sidecar/src/wire.ts', 'tool_choice: { type:', 'what forces the call'),
    ],
    returns: [
      { field: 'livesOn, happened, stake', marks: ['file', 'prompt'], note: 'into the world file as `premise`, and rendered by `premiseLines` into every later call. `callsForDancing` also reads them for the one word `disco`, `club`, `dance` or `nightclub`, which is what puts a floor to dance on in a bar.' },
      { field: 'sides[].name, sides[].wants', marks: ['file', 'prompt'], note: 'the first two are the fork the main line is written between. `wants` is read by the dancing regex too. Nothing in the running game turns a side into a faction: `reward.faction` still comes out as one value.' },
      { field: 'common[]', marks: ['file', 'prompt'], note: 'what everybody knows. Rendered into every descriptive prompt and stored. No engine rule reads it, not even the dancing one.' },
      { field: 'build.moreOf', marks: ['file', 'shape'], note: 'multiplies that kind\'s weight in the plot mix by 1.8 (`STORIED`), and protects it from the two kinds the dice drop.' },
      { field: 'build.fewerOf', marks: ['file', 'shape'], note: 'multiplies by 0.5 (`SPARED`), and is ignored for anywhere people live.' },
      { field: 'build.mustHave', marks: ['file', 'shape'], note: 'placed on a seeded site before the mix rolls at all, and worth +5 on the door ranking, so a demanded kind is there and is likely to be one that opens.' },
      { field: 'a word in build with no charter', marks: ['dropped'], note: 'taken out of `build` by `declared()` after the charter call, and again by `readHistory` on the forge side, so the history only ever names kinds the town can raise.' },
    ],
    checks: [
      { text: '`common` is empty. The schema has no `minItems`, so an empty list is valid JSON against it.', at: site('game/scribe/src/premise.ts', "path: 'common'", 'refused here') },
      { text: 'The two sides of the fork have the same name.', at: site('game/scribe/src/premise.ts', "path: 'sides.1.name'", 'refused here') },
      { text: 'A kind is in both `moreOf` and `fewerOf`.', at: site('game/scribe/src/premise.ts', "path: 'build.fewerOf'", 'refused here') },
      { text: 'Nothing in `moreOf` and nothing in `mustHave`: a history that moves no building.', at: site('game/scribe/src/premise.ts', "path: 'build',", 'refused here') },
      { text: 'A plural of a preset (hotels, bars) is folded back onto the preset before invented words are counted.', at: site('game/scribe/src/charters.ts', 'export function onPresets', 'folded here') },
    ],
  }
}

function charterCall(word: Word): Call {
  return {
    tool: 'write_charter',
    what: `what one invented kind of place is, one call per word (shown pinned to "${word}")`,
    prompts: ['system', 'write-charter', 'asked-brief', 'tool-write-charter'],
    schema: () => charterTool(word).contract.jsonSchema() as Json,
    schemaNote: '@gb/world CharterSchema with `word` pinned to a constant',
    sites: [
      site('game/scribe/src/charters.ts', 'charterTool(word)', 'the call'),
      site('game/scribe/src/tools.ts', 'export function charterTool', 'the tool'),
      site('game/world/src/model/charter.ts', 'export const CharterSchema', 'the contract it is built from'),
    ],
    returns: [
      { field: 'label', marks: ['file', 'prompt'], note: 'what a person calls such a place. Every later prompt about one of these buildings is shown it.' },
      { field: 'blade', marks: ['file', 'screen'], note: 'the word spelled down the blade sign on the front of the building, and on a subway entrance.' },
      { field: 'names[]', marks: ['file'], note: 'the templates the offline sign composer fills, `{family}`, `{adjective}`, `{noun}`. The model path hangs signs with `name_signs` instead.' },
      { field: 'rumours[]', marks: ['prompt'], note: 'rendered into prompts by `charter-lines.ts` and read by nothing else in the repository. No person in the game ever says one.' },
      { field: 'share, prominence, residential, size, street, access, transit, service, work, holding, finish, rooms', marks: ['file', 'shape'], note: 'every one is a routine the engine already runs: the mix weight, the facade, whether the door opens to you, which rooms are cut, what stands in them, whether a room is shut and whether a screen goes on the desk.' },
    ],
    checks: [
      { text: 'A blade with no letter or digit on it.', at: site('game/scribe/src/charters.ts', 'test(charter.blade)', 'refused here') },
      { text: 'A name template with no slot, which would hang one sign over every door of the kind.', at: site('game/scribe/src/charters.ts', 'has no slot: put', 'refused here') },
      { text: 'A word the model will not write a charter for is dropped from `build` rather than costing the history.', at: site('game/scribe/src/charters.ts', 'export function declared', 'dropped here') },
    ],
  }
}

function nameCityCall(): Call {
  return {
    tool: 'name_city',
    what: 'the name on the road sign at the edge of town',
    prompts: ['system', 'name-city', 'no-history', 'tool-name-city'],
    schema: () => NAME_CITY.contract.jsonSchema() as Json,
    schemaNote: 'one string, 2 to 60 characters',
    sites: [
      site('game/scribe/src/scribe.ts', '      NAME_CITY,', 'the call'),
      site('game/forge/src/forge.ts', 'await this.#narrator.nameCity', 'who asks for it'),
    ],
    returns: [
      { field: 'name', marks: ['file', 'screen', 'prompt'], note: '`World.found({ name })`, so it is the city\'s name in the file and on the landing card, and it heads every later descriptive prompt.' },
    ],
  }
}

function signsCall(labels: readonly string[]): Call {
  return {
    tool: 'name_signs',
    what: 'the signs over the doors that do not open, twenty to a call',
    prompts: ['system', 'name-signs', 'no-history', 'tool-name-signs'],
    schema: () => signsTool(labels).contract.jsonSchema() as Json,
    schemaNote: `pinned to this batch's labels (${labels.join(', ')}); a batch is 20`,
    sites: [
      site('game/scribe/src/signs.ts', 'signsTool(labels)', 'the call'),
      site('game/scribe/src/signs.ts', 'const BATCH', 'how many to a call'),
      site('game/forge/src/forge.ts', 'this.#narrator.namePlaces?.', 'who asks for it'),
      site('game/forge/src/raise/plan.ts', 'export function hangSigns', 'where the answers are put on the buildings'),
    ],
    returns: [
      { field: 'signs[].building', marks: ['shape'], note: 'the caller\'s own label, `b<plot index>`. It comes straight back so the answers are zipped on by id, never by order.' },
      { field: 'signs[].name', marks: ['file', 'screen'], note: '`plot.name`: the sign on the front of the building. A name whose head word is already over another door is thrown away and the offline composer writes that one instead.' },
    ],
    checks: [
      { text: 'A building named twice, or missed. The batch is refused with the label named.', at: site('game/scribe/src/signs.ts', 'function labelProblems', 'checked here') },
      { text: 'A head word already over a door in this city, or twice inside one batch.', at: site('game/scribe/src/signs.ts', 'function headProblems', 'checked here') },
    ],
  }
}

const TOLD: readonly Fact[] = [
  { text: 'The theme, one free-text line, and the seed, which the prompt says out loud is a tag and not part of the story.', at: site('game/scribe/src/premise.ts', "theme: input.theme", '') },
  { text: 'The owner\'s own words, verbatim and quoted, under "What the owner asked for". The tone, the main errand and the look go beside it, each only if it was filled in; a form left wholly blank is told the choice is the model\'s.', at: site('game/scribe/src/asked.ts', 'export function askedLines', '') },
  { text: 'The words every town already has a kind of place for, so it knows what it need not invent:', at: site('game/scribe/src/premise.ts', 'SHIPPED_CHARTERS.map', ''), values: PRESET_WORDS },
  { text: 'The charter call is told the history, the one word it is filling in, and the preset words it is not.', at: site('game/scribe/src/charters.ts', "prompt('write-charter'", '') },
  { text: 'The sign batch is told the history and, for each of twenty buildings, its label and the street its door is on. Nothing else about the building.', at: site('game/scribe/src/signs.ts', 'buildings: bullets(', '') },
  { text: 'Nothing about size. No grid, no plot count, no metres, no storeys: the history is written before a street is laid, so there is nothing yet to be told.', at: site('game/forge/src/forge.ts', 'const history = readHistory(', '') },
]

const ENGINE: readonly Fact[] = [
  { text: `Every metre. A grid cell is ${METRICS.cellSize} m a side, and every cell is one of these:`, at: site('game/world/src/metrics.ts', 'cellSize:', 'the sizes'), values: Object.keys(CELL) },
  { text: 'The streets: how many blocks, how wide each band is, where the crossings fall and how many roads leave through the mountains.', at: site('game/forge/src/layout/plan.ts', 'export function planStreets', 'planned before the history is even asked for') },
  { text: `The mountain ring the town sits inside is ${MOUNTAIN_CELLS} cells deep, whatever the story says.`, at: site('game/forge/src/layout/bands.ts', 'export const MOUNTAIN_CELLS', '') },
  { text: 'Where each plot sits, how big it is, which wall its door is on and how many storeys it gets.', at: site('game/forge/src/layout/plots.ts', 'export function sitesInBlock', '') },
  { text: 'Which kind each individual plot gets. The history moves the weights; the roll is the seed\'s.', at: site('game/forge/src/forge.ts', 'siteRng.weighted(weights)', '') },
  { text: 'The fourteen kinds every town already has, whatever the history invents beside them:', at: site('game/world/src/charters/presets/index.ts', 'SHIPPED_CHARTERS', ''), values: PRESET_WORDS },
  { text: 'How many doors open: the brief\'s `openPlaces`, a count the city carries rather than a share of its plots.', at: site('game/forge/src/interior/budget.ts', 'export const OPEN_PLACES', '') },
  { text: 'Which doors open: a ranking over what the place is worth, how near the middle it stands, whether it is on an avenue, how much floor is behind it, and how many of that kind already opened. `mustHave` is worth +5 on it and nothing else the model writes counts.', at: site('game/forge/src/interior/open.ts', 'export function openDoors', '') },
  { text: 'Where fast travel boards: spaced by distance across the town, never rolled in the mix.', at: site('game/forge/src/layout/stations.ts', 'export function stationsWanted', '') },
  { text: 'Every id in the city (`plot_0001`, `interior_0003`, `npc_0012`). The model never sees one until it is handed one back.', at: site('game/forge/src/raise/plan.ts', "world.mintId('interior')", '') },
]
