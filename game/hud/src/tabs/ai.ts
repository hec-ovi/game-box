import { el } from '../dom.ts'
import { AI } from '../phrase.ts'
import type { AiJobId, AiView, HudIntent } from '../types.ts'
import { JobRow } from './ai-job.ts'
import { ProviderRow } from './ai-provider.ts'

/**
 * The settings tab's other face: which AI runs which job, and the providers
 * behind them. Rows keep their node from push to push, so a field being typed
 * in is not rebuilt under the player. With no `ai` pushed, both groups are off
 * the tab entirely.
 */
export class AiSettings {
  readonly node = el('div', 'gb-ai')
  #providers = el('section', 'gb-setting gb-ai-providers')
  #jobs = el('section', 'gb-setting gb-ai-jobs')
  #emit: (intent: HudIntent) => void
  #providerList = el('div', 'gb-rows')
  #jobList = el('div', 'gb-rows')
  #noProviders = el('p', 'gb-empty gb-t3', AI.noProviders)
  #noJobs = el('p', 'gb-empty gb-t3', AI.noJobs)
  #providerRows = new Map<string, ProviderRow>()
  #jobRows = new Map<AiJobId, JobRow>()
  #providerOrder = ''
  #jobOrder = ''

  constructor(emit: (intent: HudIntent) => void) {
    this.#emit = emit
    this.#providers.append(el('h3', 'gb-t5 gb-section-head', AI.providers), this.#providerList, this.#noProviders)
    this.#jobs.append(el('h3', 'gb-t5 gb-section-head', AI.jobs), this.#jobList, this.#noJobs)
  }

  render(ai: AiView | undefined): void {
    if (!ai) {
      this.clear()
      return
    }
    if (!this.#providers.isConnected) this.node.append(this.#providers, this.#jobs)
    // A group with nothing in it says so, rather than standing empty under its heading.
    this.#noProviders.hidden = ai.providers.length > 0
    this.#noJobs.hidden = ai.jobs.length > 0
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
      this.#keep(this.#providerRows, ai.providers.map((one) => one.id))
      this.#providerList.replaceChildren(...ai.providers.map((one) => this.#providerRows.get(one.id)!.node))
    }
    const jobOrder = ai.jobs.map((one) => one.id).join(',')
    if (jobOrder !== this.#jobOrder) {
      this.#jobOrder = jobOrder
      this.#keep(this.#jobRows, ai.jobs.map((one) => one.id))
      this.#jobList.replaceChildren(...ai.jobs.map((one) => this.#jobRows.get(one.id)!.node))
    }
  }

  clear(): void {
    this.node.replaceChildren()
    this.#providerRows.clear()
    this.#jobRows.clear()
    this.#providerOrder = this.#jobOrder = ''
    this.#providerList.replaceChildren()
    this.#jobList.replaceChildren()
  }

  /** Drop the rows for anything the game no longer pushes. */
  #keep<K, V>(rows: Map<K, V>, live: readonly K[]): void {
    const alive = new Set(live)
    for (const id of [...rows.keys()]) if (!alive.has(id)) rows.delete(id)
  }
}
