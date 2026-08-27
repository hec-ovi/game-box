import { AI } from '../phrase.ts'
import type { AiJob, AiJobId, AiProvider, HudIntent } from '../types.ts'
import { Picker } from '../ui/field.ts'
import type { IconName } from '../ui/icon.ts'
import { Row } from '../ui/row.ts'

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
  readonly node: HTMLElement
  #row: Row
  #pick: Picker

  constructor(job: AiJob, emit: (intent: HudIntent) => void) {
    this.#row = new Row({ icon: JOB_ICON[job.id], title: job.label, compact: true, className: 'gb-ai-job' })
    this.#pick = new Picker({
      label: job.label,
      empty: AI.pickProvider,
      none: AI.noneReady,
      pick: (providerId) => emit({ kind: 'ai-job', jobId: job.id, providerId }),
    })
    this.#row.state.append(this.#pick.node)
    this.#row.node.dataset.acts = 'true'
    this.node = this.#row.node
  }

  render(job: AiJob, providers: readonly AiProvider[]): void {
    const ready = providers.filter((one) => one.configured)
    const on = ready.find((one) => one.id === job.providerId)
    this.#row.says(job.label, on ? `${on.label} · ${on.model}` : ready.length ? AI.unassigned : AI.noneReady)
    this.#row.keyLine(on ? 'on' : null)
    this.#pick.offers(
      ready.map((one) => ({ value: one.id, label: one.label })),
      on?.id,
    )
  }
}
