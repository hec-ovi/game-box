import { el, setText } from '../dom.ts'
import { Reveal } from '../reveal.ts'
import type { HudState, LoadStage } from '../types.ts'
import type { Surface } from './surface.ts'

/**
 * A city being written: what it is called and each stage of the build with
 * how far it has got, so minutes of model work read as progress rather than
 * one line that does not move. It covers the whole view while it is up and
 * goes the moment the game takes it away.
 */
export class LoaderSurface implements Surface {
  readonly node = el('section', 'gb-loader')
  #title = el('h2')
  #list = el('ol', 'gb-stages')
  #rows = new Map<string, StageRow>()
  #reveal: Reveal

  constructor() {
    this.node.setAttribute('role', 'status')
    this.node.setAttribute('aria-live', 'polite')
    const card = el('div', 'gb-loader-card gb-bracket')
    card.append(this.#title, this.#list)
    this.node.append(card)
    this.#reveal = new Reveal(this.node, { onClosed: () => this.#clear() })
  }

  render(state: HudState): void {
    const loading = state.loading
    if (loading) {
      setText(this.#title, loading.title)
      this.#stages(loading.stages)
    }
    this.#reveal.set(loading !== undefined)
  }

  dispose(): void {
    this.#reveal.dispose()
  }

  /** Rows keep their node from push to push, so a bar fills rather than blinks. */
  #stages(stages: readonly LoadStage[]): void {
    const ids = stages.map((stage) => stage.id)
    if (ids.join('|') !== [...this.#rows.keys()].join('|')) {
      this.#rows = new Map(stages.map((stage) => [stage.id, new StageRow()]))
      this.#list.replaceChildren(...[...this.#rows.values()].map((row) => row.node))
    }
    for (const stage of stages) this.#rows.get(stage.id)!.write(stage)
  }

  #clear(): void {
    setText(this.#title, '')
    this.#rows.clear()
    this.#list.replaceChildren()
  }
}

class StageRow {
  readonly node = el('li', 'gb-stage')
  #label = el('span', 'gb-what')
  #count = el('span', 'gb-num')
  #bar = el('div', 'gb-bar-fill')

  constructor() {
    const track = el('div', 'gb-bar-track')
    track.append(this.#bar)
    const line = el('div', 'gb-stage-line')
    line.append(this.#label, this.#count)
    this.node.append(line, track)
  }

  write(stage: LoadStage): void {
    this.node.dataset.state = stage.state
    setText(this.#label, stage.label)
    const counted = stage.total !== undefined && stage.total > 0
    setText(this.#count, counted ? `${stage.done ?? 0}/${stage.total}` : '')
    const share = stage.state === 'done' ? 1 : counted ? Math.min(1, (stage.done ?? 0) / stage.total!) : 0
    this.#bar.style.width = `${Math.round(share * 100)}%`
    this.node.setAttribute('role', 'progressbar')
    this.node.setAttribute('aria-label', stage.label)
    this.node.setAttribute('aria-valuemin', '0')
    this.node.setAttribute('aria-valuemax', '100')
    this.node.setAttribute('aria-valuenow', String(Math.round(share * 100)))
  }
}
