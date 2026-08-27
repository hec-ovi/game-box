/**
 * The shape every stage is drawn in, and the parts they share.
 *
 * A stage is the boundary and then its calls. The boundary is two lists: what
 * this stage is told, and what the engine settles without asking. Each call is
 * the instructions the model is given, the tool it is forced to call, what comes
 * back and what happens to each field of it, and the line it is issued at. The
 * sandbox underneath runs that one stage and shows the request and the reply as
 * they were.
 */
import type { Narrator, Unwritten } from '@gb/forge'
import { add, chips, clear, el, fold, json, panel, pre, table } from './dom.ts'
import { markdown } from './markdown.ts'
import { problemsOf, stopOf } from './pipeline.ts'
import type { Author, Captured, Exchange, Form, Recorder } from './pipeline.ts'
import { schemaTable, type Json } from './schema.ts'
import { promptFile, type Site } from './source.ts'
import { SPEC_PATH, specSays, stageSpec } from './spec.ts'

/** Where a field the model wrote ends up. */
export type Mark = 'file' | 'screen' | 'prompt' | 'shape' | 'dropped'

const MARK_WORD: Record<Mark, string> = {
  file: 'in the file',
  screen: 'on screen',
  prompt: 'prompt only',
  shape: 'a handle',
  dropped: 'nothing reads it',
}

export interface Returned {
  readonly field: string
  readonly marks: readonly Mark[]
  readonly note: string
}

export interface Fact {
  readonly text: string
  readonly at?: Site
  readonly values?: readonly string[]
}

/** One forced tool call: what the model is told, what it may answer with, and what happens to the answer. */
export interface Call {
  readonly tool: string
  readonly what: string
  /** The prompt files that make up this call, in the order they are assembled. */
  readonly prompts: readonly string[]
  readonly schema: () => Json | undefined
  readonly schemaNote?: string
  readonly sites: readonly Site[]
  readonly returns: readonly Returned[]
  /** What the schema cannot refuse, refused in code afterwards. */
  readonly checks?: readonly Fact[]
}

export interface Lab {
  form: Form
  author: Author
  base: string
  readonly captured: Captured
  readonly recorder: Recorder
  /** Redraw the page: a capture in one stage is an input in the next. */
  readonly refresh: () => void
}

export interface Stage {
  readonly id: string
  readonly n: number
  readonly title: string
  readonly lede: string
  /** Everything this stage is handed, which is the half of the boundary that decides what it can write. */
  told(lab: Lab): readonly Fact[]
  calls(lab: Lab): readonly Call[]
  engine(lab: Lab): readonly Fact[]
  /** What that list is, in this stage's terms. */
  readonly engineNote?: string
  /**
   * What today's code also settles that the design says is not a rule the
   * writer is held to. True of the code, not a constraint on the answer, so it
   * is drawn apart from the two lists above and never mixed into them.
   */
  today?(lab: Lab): readonly Fact[]
  readonly todayNote?: string
  sandbox(lab: Lab): HTMLElement
}

/** The name and opening line the spec gives this stage, or the stage file's own. */
export function nameOf(stage: Stage): { title: string; lede: string; from: string } {
  const spec = stageSpec(stage.n)
  return spec
    ? { title: spec.title, lede: spec.lede || stage.lede, from: SPEC_PATH }
    : { title: stage.title, lede: stage.lede, from: 'tools/lab/src/stages/' }
}

/** The whole of one stage's page. */
export function renderStage(stage: Stage, lab: Lab): HTMLElement {
  const named = nameOf(stage)
  const page = el(
    'div',
    { class: 'page' },
    el('p', { class: 'lede' }, named.lede),
    el('p', { class: 'hint' }, specSays()),
  )
  page.appendChild(boundaryView(stage, lab))
  for (const call of stage.calls(lab)) page.appendChild(callView(call, lab))
  page.appendChild(stage.sandbox(lab))
  return page
}

/**
 * The boundary the owner cares about, both halves of it side by side: what this
 * stage is told, and what the engine settles without asking. What a stage may
 * hand back is the "What comes back" table of each call below.
 */
function boundaryView(stage: Stage, lab: Lab): HTMLElement {
  const today = stage.today?.(lab) ?? []
  return el(
    'div',
    { class: 'cols' },
    panel(
      'What this stage is told',
      'the least that lets it do its own job',
      el('p', { class: 'hint' }, 'Nothing else reaches it. A stage handed less writes about less; a stage handed a number starts being careful about the number.'),
      factList(stage.told(lab)),
    ),
    panel(
      'What the engine decides, not the model',
      stage.engineNote ?? 'settled before the question goes out',
      factList(stage.engine(lab)),
    ),
    today.length > 0 &&
      panel(
        'What today\'s code also settles',
        stage.todayNote ?? 'true of the code, not a rule the writer is held to',
        factList(today),
      ),
  )
}

function callView(call: Call, lab: Lab): HTMLElement {
  const sent = lastSent(lab.recorder.exchanges, call.tool)
  return el(
    'div',
    { class: 'cols' },
    el('h2', { class: 'wide' }, `${call.tool}  —  ${call.what}`),
    panel(
      'The instructions',
      `${call.prompts.length} prompt files`,
      ...call.prompts.map((name, index) => {
        const file = promptFile(name)
        return fold(
          name,
          file.path,
          index === 1,
          file.drifted &&
            el(
              'p',
              { class: 'drift' },
              'This file and src/prompts.generated.ts have parted. The build sends the generated one: run pnpm --filter @gb/scribe run generate.',
            ),
          markdown(file.text),
        )
      }),
      sent
        ? fold('The message that actually went out', 'from the last run', false, pre(userOf(sent)))
        : el('p', { class: 'hint' }, 'Run the sandbox below to see these filled in and sent.'),
    ),
    panel(
      'The tool',
      call.schemaNote,
      schemaTable(call.schema()),
      fold('The JSON Schema as sent', 'the object in tools[0].function.parameters', false, json(call.schema(), true)),
      call.checks?.length &&
        fold(
          'What the schema cannot refuse',
          'checked in code after the contract accepts',
          false,
          factList(call.checks),
        ),
    ),
    panel(
      'What comes back',
      undefined,
      table(
        ['Field', 'Where it goes', 'What happens to it'],
        call.returns.map((one) => [
          one.field,
          el('span', {}, ...one.marks.map((mark) => el('span', { class: `mark mark-${mark}` }, MARK_WORD[mark]))),
          el('span', { class: 'w' }, one.note),
        ]),
        () => 'f',
      ),
    ),
    panel('Where it lives', undefined, siteTable(call.sites)),
  )
}

function factList(facts: readonly Fact[]): HTMLElement {
  const list = el('ul', { class: 'facts' })
  for (const fact of facts) {
    const item = el('li', {}, fact.text)
    if (fact.at) add(item, [' ', el('span', { class: 'at' }, `${fact.at.path}:${fact.at.line || '?'}`)])
    if (fact.values?.length) item.appendChild(chips(fact.values))
    list.appendChild(item)
  }
  return list
}

function siteTable(sites: readonly Site[]): HTMLElement {
  return table(
    ['What', 'File and line', 'The line'],
    sites.map((one) => [
      one.what,
      el('span', { class: 'c' }, `${one.path}:${one.line || '?'}`),
      el('span', { class: 'c' }, one.text),
    ]),
    () => 'w',
  )
}

/** The user message of the last call that offered this tool. */
function lastSent(exchanges: readonly Exchange[], tool: string): Exchange | undefined {
  return [...exchanges].reverse().find((one) => one.tool === tool)
}

function userOf(exchange: Exchange): string {
  const messages = (exchange.request as { messages?: Array<{ role?: string; content?: string }> }).messages ?? []
  return messages.find((one) => one.role === 'user')?.content ?? '(no user message)'
}

/* ---------- the sandbox ---------- */

export interface Run {
  /** The panel to put in the page. */
  readonly root: HTMLElement
  readonly out: HTMLElement
  say(text: string, kind?: 'good' | 'bad' | 'work'): void
  /**
   * A stage that would not write: the stage, the call and the sentence, drawn
   * under whatever has already gone out, so the request and the reply that led
   * to it are still on the page.
   */
  stopped(error: Unwritten): void
}

/**
 * The sandbox chrome every stage shares: the controls, one Run button, a line
 * saying what is happening, and whatever the stage wants to show underneath.
 */
export function sandbox(
  lab: Lab,
  title: string,
  controls: readonly (HTMLElement | false | undefined)[],
  go: (run: Run, signal: AbortSignal) => Promise<void>,
): HTMLElement {
  const out = el('div')
  const status = el('span', { class: 'status' }, 'ready')
  const say = (text: string, kind?: 'good' | 'bad' | 'work'): void => {
    status.className = kind ? `status ${kind}` : 'status'
    status.textContent = text
  }
  let halted = false
  const run: Run = {
    root: out,
    out,
    say,
    stopped(error) {
      halted = true
      const stop = stopOf(error)
      add(out, [
        el('h3', {}, 'The stage would not write'),
        table(['Stage', 'The call', 'Why'], [[stop.stage, stop.at, stop.code]], () => 'f'),
        el('p', { class: 'stopped' }, stop.message),
        el('p', { class: 'hint' }, 'Nothing is composed in its place: a build that hits this has no city.'),
      ])
    },
  }
  const button = el('button', { class: 'go' }, 'Run')
  const stop = el('button', { disabled: true }, 'Stop')
  let controller: AbortController | undefined

  button.addEventListener('click', () => {
    if (controller) return
    controller = new AbortController()
    button.disabled = true
    stop.disabled = false
    halted = false
    clear(out)
    lab.recorder.clear()
    say(`running against the ${lab.author} author`, 'work')
    const started = performance.now()
    void go(run, controller.signal)
      .then(() => {
        const ms = Math.round(performance.now() - started)
        say(halted ? `stopped after ${ms} ms` : `done in ${ms} ms`, halted ? 'bad' : 'good')
      })
      .catch((cause: unknown) => {
        say(String(cause), 'bad')
        out.appendChild(pre(String((cause as Error)?.stack ?? cause)))
      })
      .finally(() => {
        controller = undefined
        button.disabled = false
        stop.disabled = true
      })
  })
  stop.addEventListener('click', () => controller?.abort())

  const body = el('div', { class: 'cols' })
  const left = panel('Sandbox: ' + title, undefined, ...controls.filter(Boolean), el('div', { class: 'row' }, button, stop, status))
  const right = panel('What happened', undefined, out)
  body.appendChild(left)
  body.appendChild(right)
  return body
}

/** Every call that failed on the way, the ones a later attempt got right included. */
export function showProblems(run: Run, author: Narrator): void {
  const problems = problemsOf(author)
  if (!problems.length) return
  add(run.out, [el('h3', {}, `Rejected along the way (${problems.length})`), json(problems, true)])
}

/** Every call of a run, exactly as it went out and came back. */
export function exchangeViews(exchanges: readonly Exchange[]): HTMLElement {
  if (!exchanges.length) {
    return el('p', { class: 'hint' }, 'No call went out. The offline author writes from the seed, with no model behind it.')
  }
  const box = el('div')
  for (const one of exchanges) {
    box.appendChild(
      fold(
        `${one.n}. ${one.tool}`,
        `HTTP ${one.status}, ${one.ms} ms`,
        exchanges.length === 1,
        el('h3', {}, 'The request'),
        json(one.request, true),
        el('h3', {}, 'The reply, raw'),
        pre(prettyIfJson(one.reply), true),
      ),
    )
  }
  return box
}

function prettyIfJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}
