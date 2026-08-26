import { el, setText } from '../dom.ts'
import { Reveal } from '../reveal.ts'
import type { HudState, LoadStage } from '../types.ts'
import { ICON_PX, icon } from '../ui/icon.ts'
import { Meter } from '../ui/meter.ts'
import type { Surface } from './surface.ts'

/**
 * The view covered while the game is busy. A city being written: what it is
 * called and each stage of the build with how far it has got, so minutes of
 * model work read as progress rather than one line that does not move. With
 * no stages it is a veil, the title alone: a ride between stations.
 *
 * Rows keep their node from push to push, so a bar fills rather than blinks,
 * and it fills by scaling, so a build reporting progress costs no layout.
 */
export class LoaderSurface implements Surface {
  readonly node = el('section', 'gb-loader')
  #title = el('h2', 'gb-t7')
  #list = el('ol', 'gb-stages')
  #rows = new Map<string, StageRow>()
  #percent = el('span', 'gb-radar-percent', '100%')
  #reveal: Reveal

  constructor() {
    this.node.setAttribute('role', 'status')
    this.node.setAttribute('aria-live', 'polite')
    const card = el('div', 'gb-loader-card')
    const radar = el('div', 'gb-loader-radar')
    radar.innerHTML = `
      <svg class="gb-radar-svg" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" class="gb-radar-track gb-radar-track-outer" />
        <circle cx="60" cy="60" r="52" class="gb-radar-arc gb-radar-arc-outer-cyan" />
        <circle cx="60" cy="60" r="52" class="gb-radar-arc gb-radar-arc-outer-amber" />
        <circle cx="60" cy="60" r="42" class="gb-radar-track gb-radar-track-mid" />
        <circle cx="60" cy="60" r="42" class="gb-radar-arc gb-radar-arc-mid" />
        <circle cx="60" cy="60" r="30" class="gb-radar-track gb-radar-track-inner" />
        <circle cx="60" cy="60" r="30" class="gb-radar-arc gb-radar-arc-inner" />
      </svg>
    `
    radar.append(this.#percent)
    card.append(radar, this.#title, this.#list)
    this.node.append(card)
    this.#reveal = new Reveal(this.node, { kind: 'veil', onClosed: () => this.#clear() })
  }

  render(state: HudState): void {
    const loading = state.loading
    if (loading) {
      setText(this.#title, loading.title)
      this.node.dataset.veil = String(loading.stages.length === 0)
      this.#stages(loading.stages)
      if (loading.stages.length > 0) {
        const doneCount = loading.stages.filter((s) => s.state === 'done').length
        const pct = Math.round((doneCount / loading.stages.length) * 100)
        this.#percent.textContent = `${pct}%`
      } else {
        this.#percent.textContent = '100%'
      }
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
  #mark = el('span', 'gb-stage-mark')
  #label = el('span', 'gb-what gb-t1')
  #count = el('span', 'gb-num gb-t0')
  #meter = new Meter(true)
  #state: LoadStage['state'] | undefined

  constructor() {
    const line = el('div', 'gb-stage-line')
    line.append(this.#mark, this.#label, this.#count)
    this.node.append(line, this.#meter.node)
  }

  write(stage: LoadStage): void {
    this.node.dataset.state = stage.state
    if (stage.state !== this.#state) {
      this.#state = stage.state
      this.#mark.replaceChildren(...(stage.state === 'done' ? [icon('check', ICON_PX.line)] : []))
    }
    setText(this.#label, stage.label)
    const counted = stage.total !== undefined && stage.total > 0
    setText(this.#count, counted ? `${stage.done ?? 0}/${stage.total}` : '')
    const share = stage.state === 'done' ? 1 : counted ? Math.min(1, (stage.done ?? 0) / stage.total!) : 0
    this.#meter.set(share)
    this.node.setAttribute('role', 'progressbar')
    this.node.setAttribute('aria-label', stage.label)
    this.node.setAttribute('aria-valuemin', '0')
    this.node.setAttribute('aria-valuemax', '100')
    this.node.setAttribute('aria-valuenow', String(Math.round(share * 100)))
  }
}
