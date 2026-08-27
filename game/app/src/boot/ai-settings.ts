import type { AiJobId, AiView } from '@gb/hud'
import type { AiIntent } from '../ai.ts'
import { JobRow } from './ai-job-row.ts'
import { ProviderRow } from './ai-provider-row.ts'

/**
 * Which AI runs which job, on the launcher's settings face: the providers, and
 * the five jobs pointed at them. It is the settings tab in game with the same
 * words and the same six reports, drawn in the panel's own shapes, because the
 * service holds the state and both screens are looking at it.
 *
 * Rows keep their node from push to push, so a field being typed in is not
 * rebuilt under the player.
 */
export class AiSettings {
  #providerList: HTMLElement
  #jobList: HTMLElement
  #noProviders: HTMLElement
  #noJobs: HTMLElement
  #trouble: HTMLElement
  #emit: (intent: AiIntent) => void
  #providerRows = new Map<string, ProviderRow>()
  #jobRows = new Map<AiJobId, JobRow>()
  #providerOrder = ''
  #jobOrder = ''

  constructor(input: {
    providers: HTMLElement
    jobs: HTMLElement
    noProviders: HTMLElement
    noJobs: HTMLElement
    trouble: HTMLElement
    emit: (intent: AiIntent) => void
  }) {
    this.#providerList = input.providers
    this.#jobList = input.jobs
    this.#noProviders = input.noProviders
    this.#noJobs = input.noJobs
    this.#trouble = input.trouble
    this.#emit = input.emit
  }

  /**
   * What the service says, and why there is nothing when there is nothing.
   * A group the service pushed nothing into says so rather than standing
   * empty, and a service that never answered says that instead of both.
   */
  render(ai: AiView | undefined, trouble?: string): void {
    this.#trouble.hidden = ai !== undefined
    if (trouble) {
      this.#trouble.textContent = trouble
      this.#trouble.dataset.tone = 'bad'
    }
    this.#noProviders.hidden = ai === undefined || ai.providers.length > 0
    this.#noJobs.hidden = ai === undefined || ai.jobs.length > 0
    if (!ai) {
      this.#providerRows.clear()
      this.#jobRows.clear()
      this.#providerOrder = this.#jobOrder = ''
      this.#providerList.replaceChildren()
      this.#jobList.replaceChildren()
      return
    }

    for (const provider of ai.providers) {
      const row = this.#providerRows.get(provider.id)
      if (row) row.render(provider)
      else this.#providerRows.set(provider.id, new ProviderRow(provider, this.#emit))
    }
    for (const job of ai.jobs) {
      let row = this.#jobRows.get(job.id)
      if (!row) {
        row = new JobRow(job, this.#emit)
        this.#jobRows.set(job.id, row)
      }
      row.render(job, ai.providers)
    }

    const providerOrder = ai.providers.map((one) => one.id).join(',')
    if (providerOrder !== this.#providerOrder) {
      this.#providerOrder = providerOrder
      keep(this.#providerRows, ai.providers.map((one) => one.id))
      this.#providerList.replaceChildren(...ai.providers.map((one) => this.#providerRows.get(one.id)!.node))
    }
    const jobOrder = ai.jobs.map((one) => one.id).join(',')
    if (jobOrder !== this.#jobOrder) {
      this.#jobOrder = jobOrder
      keep(this.#jobRows, ai.jobs.map((one) => one.id))
      this.#jobList.replaceChildren(...ai.jobs.map((one) => this.#jobRows.get(one.id)!.node))
    }
  }
}

/** Drop the rows for anything the service no longer lists. */
function keep<K, V>(rows: Map<K, V>, live: readonly K[]): void {
  const alive = new Set(live)
  for (const id of [...rows.keys()]) if (!alive.has(id)) rows.delete(id)
}
