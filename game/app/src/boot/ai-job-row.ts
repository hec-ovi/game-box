import type { AiJob, AiJobId, AiProvider } from '@gb/hud'
import type { AiIntent } from '../ai.ts'
import { Picker } from './ai-field.ts'
import { AI } from './ai-words.ts'
import { icon, line } from './chrome.ts'
import type { IconName } from './icons.ts'

/** What each job writes, in a picture. */
const JOB_ICON: Record<AiJobId, IconName> = {
  history: 'codex',
  city: 'map',
  places: 'door',
  quests: 'quest-side',
  dialogs: 'person',
}

/**
 * One job and the provider it is pointed at, picked from the ones that are
 * ready. A job pointed at nothing says so; with no provider ready yet, the
 * list says that instead of standing empty.
 */
export class JobRow {
  readonly node = document.createElement('div')
  #title = line('gb-set-name gb-t4', '')
  #under = line('gb-set-under gb-t2', '')
  #pick: Picker

  constructor(job: AiJob, emit: (intent: AiIntent) => void) {
    this.node.className = 'gb-set-job'
    const tile = document.createElement('span')
    tile.className = 'gb-set-tile'
    tile.append(icon(JOB_ICON[job.id], 16))
    const names = document.createElement('span')
    names.className = 'gb-set-names'
    names.append(this.#title, this.#under)
    this.#pick = new Picker({
      label: job.label,
      empty: AI.pickProvider,
      none: AI.noneReady,
      pick: (providerId) => emit({ kind: 'ai-job', jobId: job.id, providerId }),
    })
    this.node.append(tile, names, this.#pick.node)
  }

  render(job: AiJob, providers: readonly AiProvider[]): void {
    const ready = providers.filter((one) => one.configured)
    const on = ready.find((one) => one.id === job.providerId)
    this.#title.textContent = job.label
    this.#under.textContent = on ? `${on.label} · ${on.model}` : ready.length ? AI.unassigned : AI.noneReady
    this.node.dataset.on = String(Boolean(on))
    this.#pick.offers(
      ready.map((one) => ({ value: one.id, label: one.label })),
      on?.id,
    )
  }
}
