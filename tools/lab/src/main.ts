/**
 * The generation lab: four stages of a city build, each one shown as the
 * instructions the model is given, the tool it is forced to call, what comes
 * back and what the engine does with it, where the call is issued, and what the
 * engine decides on its own. Underneath each stage, a sandbox that runs that
 * stage and prints the request and the reply as they were.
 *
 * It is a developer page. Nothing in it ships into the game.
 */
import { clear, el, field, panel, pre } from './dom.ts'
import {
  buildCity,
  DEFAULT_BASE,
  defaultForm,
  health,
  narratorFor,
  openWorld,
  Recorder,
  summaryOf,
  type Captured,
  type Form,
} from './pipeline.ts'
import type { Lab, Stage } from './stage.ts'
import { nameOf, renderStage } from './stage.ts'
import { CITY } from './stages/city.ts'
import { INSTANCES } from './stages/instances.ts'
import { PEOPLE } from './stages/people.ts'
import { QUESTS } from './stages/quests.ts'

const STAGES: readonly Stage[] = [CITY, INSTANCES, PEOPLE, QUESTS]

const captured: Captured = {}
const lab: Lab = {
  form: defaultForm(),
  author: 'model',
  base: DEFAULT_BASE,
  captured,
  recorder: new Recorder(),
  refresh: () => sayWhatIsInHand(),
}

const root = document.getElementById('lab')!
const healthLine = el('span', { class: 'health' }, 'checking the sidecar')
const inHand = el('pre')
const page = el('div')
let current = STAGES[0]!

root.appendChild(
  el(
    'div',
    { class: 'top' },
    el('h1', {}, 'Generation lab'),
    el('span', { class: 'sub' }, 'every forced call of a city build, its instructions, its schema, and a sandbox per stage'),
    healthLine,
  ),
)
root.appendChild(el('div', { class: 'page' }, el('div', { class: 'cols' }, briefPanel(), runPanel(), inHandPanel())))
root.appendChild(tabs())
root.appendChild(
  el(
    'p',
    { class: 'hint order' },
    'The tabs group the calls by what they write. A build runs them in this order: the history, the architecture under placeholder names, the work, the names, then the people and the insides.',
  ),
)
root.appendChild(page)

show(current)
sayWhatIsInHand()
void checkHealth()

/* ---------- the header ---------- */

function briefPanel(): HTMLElement {
  return panel(
    'The brief',
    'what a build is asked for',
    el(
      'div',
      { class: 'form' },
      field('Theme', text('theme'), true),
      field('The owner\'s own words (brief)', area('brief'), true),
      field('Seed', text('seed')),
      field('Tone', text('tone')),
      field('The main errand', text('mainQuest')),
      field('The side work', text('sideQuests')),
      field('Blocks across', number('blocksX')),
      field('Blocks down', number('blocksY')),
      field('Places that open', number('openPlaces')),
      field('Density', number('density', 0.1)),
      field('Tallest, in storeys', number('maxStoreys')),
    ),
  )
}

function runPanel(): HTMLElement {
  const author = el('select') as HTMLSelectElement
  author.appendChild(el('option', { value: 'model' }, 'the model, through the sidecar'))
  author.appendChild(el('option', { value: 'offline' }, 'the offline author, no model at all'))
  author.value = lab.author
  author.addEventListener('change', () => {
    lab.author = author.value === 'offline' ? 'offline' : 'model'
  })

  const base = el('input', { type: 'text', value: lab.base }) as HTMLInputElement
  base.addEventListener('input', () => {
    lab.base = base.value.replace(/\/$/, '')
    void checkHealth()
  })

  const status = el('span', { class: 'status' }, 'nothing captured yet')
  const build = el('button', {}, 'Build this city offline')
  build.addEventListener('click', () => {
    build.disabled = true
    status.className = 'status work'
    status.textContent = lab.captured.history ? 'building on the history from stage 1' : 'building'
    void buildCity(lab.form, narratorFor('offline', lab.form, lab.recorder, lab.base), lab.captured.history)
      .then((outcome) => {
        Object.assign(lab.captured, outcome.captured)
        status.className = outcome.error ? 'status bad' : 'status good'
        status.textContent = outcome.error ?? `built in ${outcome.ms} ms`
        sayWhatIsInHand()
      })
      .finally(() => {
        build.disabled = false
      })
  })

  const file = el('input', { type: 'file' }) as HTMLInputElement
  file.addEventListener('change', () => {
    const chosen = file.files?.[0]
    if (!chosen) return
    status.className = 'status work'
    status.textContent = `reading ${chosen.name}`
    void chosen.text().then((body) => {
      const opened = openWorld(body)
      if (!opened.world) {
        status.className = 'status bad'
        status.textContent = opened.error ?? 'could not be opened'
        return
      }
      const world = opened.world
      captured.world = world
      captured.cityName = world.name
      captured.summary = summaryOf(world)
      const premise = world.premise()
      if (premise) captured.history = { ...premise, charters: world.charters() }
      lab.form = { ...lab.form, theme: world.theme, seed: world.seed, brief: world.brief() ?? lab.form.brief }
      status.className = 'status good'
      status.textContent = `${chosen.name}: ${world.plots().length} plots, ${world.interiors().length} open, ${world.npcs().length} people`
      sayWhatIsInHand()
    })
  })

  return panel(
    'Who writes, and what is in hand',
    undefined,
    el('div', { class: 'form' }, field('The author every sandbox runs against', author), field('The sidecar', base)),
    el('p', { class: 'hint' }, 'A build through the offline author is the real Forge.build, watched at the narrator port. It is what gives stages 2, 3 and 4 a true input without waiting hours for a model to write a whole town.'),
    el('div', { class: 'row' }, build, status),
    field('Or open a world file from disk', file, true),
  )
}

function inHandPanel(): HTMLElement {
  return panel('Captured', 'the input each stage is holding', inHand)
}

function sayWhatIsInHand(): void {
  inHand.textContent = [
    `history      ${captured.history ? `${captured.history.build.mustHave.length} must-have kinds, ${captured.history.charters?.length ?? 0} charters` : 'none'}`,
    `city         ${captured.cityName ?? 'none'}`,
    `places       ${captured.instanceRequests?.length ?? 0} instance requests, ${captured.instances?.length ?? 0} written`,
    `signs        ${captured.signRequests?.length ?? 0} requested (every door is asked about, open or shut)`,
    `summary      ${captured.summary ? `${captured.summary.places.length} places, ${captured.summary.places.reduce((n, place) => n + place.npcs.length, 0)} people` : 'none'}`,
    `quests       ${captured.quests?.length ?? 0}`,
    `world        ${captured.world ? `${captured.world.plots().length} plots` : 'none'}`,
  ].join('\n')
}

async function checkHealth(): Promise<void> {
  healthLine.className = 'health'
  healthLine.textContent = 'checking the sidecar'
  const line = await health(lab.base)
  healthLine.className = line.includes('unreachable') ? 'health down' : 'health up'
  healthLine.textContent = line
}

/* ---------- the tabs ---------- */

function tabs(): HTMLElement {
  const bar = el('div', { class: 'tabs', role: 'tablist' })
  for (const stage of STAGES) {
    const button = el(
      'button',
      { class: 'tab', role: 'tab', 'aria-selected': String(stage === current) },
      el('span', { class: 'n' }, String(stage.n)),
      nameOf(stage).title,
    )
    button.addEventListener('click', () => {
      current = stage
      for (const other of bar.children) other.setAttribute('aria-selected', String(other === button))
      show(stage)
    })
    bar.appendChild(button)
  }
  return bar
}

function show(stage: Stage): void {
  clear(page)
  try {
    page.appendChild(renderStage(stage, lab))
  } catch (cause) {
    page.appendChild(el('div', { class: 'page' }, panel('This stage would not draw', undefined, pre(String((cause as Error)?.stack ?? cause)))))
  }
}

/* ---------- the form fields ---------- */

function text(key: 'theme' | 'seed' | 'brief' | 'tone' | 'mainQuest' | 'sideQuests'): HTMLElement {
  const input = el('input', { type: 'text', value: lab.form[key] }) as HTMLInputElement
  input.addEventListener('input', () => {
    lab.form = { ...lab.form, [key]: input.value }
  })
  return input
}

function area(key: 'brief'): HTMLElement {
  const input = el('textarea', { rows: '3' }) as HTMLTextAreaElement
  input.value = lab.form[key]
  input.addEventListener('input', () => {
    lab.form = { ...lab.form, [key]: input.value }
  })
  return input
}

function number(key: 'blocksX' | 'blocksY' | 'openPlaces' | 'density' | 'maxStoreys', step = 1): HTMLElement {
  const input = el('input', { type: 'number', class: 'num', step: String(step), value: String(lab.form[key]) }) as HTMLInputElement
  input.addEventListener('input', () => {
    const value = Number(input.value)
    if (Number.isFinite(value)) lab.form = { ...lab.form, [key]: value } as Form
  })
  return input
}
