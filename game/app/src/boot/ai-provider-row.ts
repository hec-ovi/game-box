import type { AiProvider } from '@gb/hud'
import type { AiIntent } from '../ai.ts'
import { Field, Picker } from './ai-field.ts'
import { AI, AI_HEALTH, AI_TONE, aiMissing, answeredIn } from './ai-words.ts'
import { button, icon, line } from './chrome.ts'
import type { IconName } from './icons.ts'

/** A service out on the net, or a server on this machine. */
const FAMILY_ICON: Record<string, IconName> = { external: 'ai', local: 'screen' }

/**
 * One provider on the launcher's settings face: what it is called over the
 * model it answers with, how it stands, what can be asked of it, and the
 * fields it needs. Everything typed here goes out as an intent and the row
 * reads what comes back from the service, so a key is stored once the service
 * says it is and not before.
 */
export class ProviderRow {
  readonly node = document.createElement('article')
  #emit: (intent: AiIntent) => void
  #id: string
  #tile = document.createElement('span')
  #name = line('gb-set-name gb-t4', '')
  #model = line('gb-set-under gb-t2', '')
  #chip = line('gb-set-chip gb-t1', '')
  #check: HTMLButtonElement
  #test: HTMLButtonElement
  #fields = document.createElement('div')
  #modelField: Field | Picker | undefined
  #modelKind = ''
  #detail: Field
  #key: Field
  #keyLine = line('gb-set-line gb-t2', '')
  #note = line('gb-set-line gb-t2', '')
  #said = document.createElement('div')
  #saidWhen = line('gb-set-said-when gb-t2', '')
  #saidText = line('gb-set-said-text gb-t2', '')
  /** What is on the row already, so a push that did not touch it does not redraw it. */
  #drawn = ''

  constructor(provider: AiProvider, emit: (intent: AiIntent) => void) {
    this.#emit = emit
    this.#id = provider.id
    const providerId = provider.id
    this.node.className = 'gb-set-provider'

    this.#detail = new Field({
      label: provider.family === 'local' ? AI.host : AI.url,
      apply: (detail) => emit({ kind: 'ai-detail', providerId, detail }),
    })
    this.#key = new Field({
      label: AI.key,
      placeholder: AI.typeKey,
      secret: true,
      button: { label: AI.store, icon: 'settings' },
      apply: (secret) => emit({ kind: 'ai-key', providerId, secret }),
    })
    this.#check = button({
      text: AI.check,
      icon: 'check',
      label: `${AI.check} ${provider.label}`,
      hint: 'Ask this provider whether it answers, and what it can run. Nothing is generated.',
      onClick: () => emit({ kind: 'ai-health', providerId }),
    })
    this.#test = button({
      text: AI.test,
      icon: 'ai',
      label: `${AI.test} ${provider.label}`,
      lit: true,
      hint: 'Make one real call through this provider and show what the model wrote.',
      onClick: () => emit({ kind: 'ai-test', providerId }),
    })

    this.#tile.className = 'gb-set-tile'
    const names = document.createElement('span')
    names.className = 'gb-set-names'
    names.append(this.#name, this.#model)
    const acts = document.createElement('div')
    acts.className = 'gb-set-acts'
    acts.append(this.#chip, this.#check, this.#test)
    const head = document.createElement('header')
    head.className = 'gb-set-provider-head'
    head.append(this.#tile, names, acts)

    this.#fields.className = 'gb-set-fields'
    this.#fields.append(this.#detail.node, this.#key.node)
    this.#said.className = 'gb-set-said'
    this.#said.append(this.#saidWhen, this.#saidText)
    this.node.append(head, this.#fields, this.#keyLine, this.#note, this.#said)
    this.render(provider)
  }

  render(provider: AiProvider): void {
    const key = JSON.stringify(provider)
    if (key === this.#drawn) return
    this.#drawn = key

    this.#tile.replaceChildren(icon(FAMILY_ICON[provider.family] ?? 'ai', 16))
    this.#name.textContent = provider.label
    this.#model.textContent = provider.model
    this.#chip.textContent = AI_HEALTH[provider.health]
    this.#chip.dataset.tone = AI_TONE[provider.health]
    this.node.dataset.health = provider.health
    this.#check.disabled = provider.health === 'checking'
    this.#test.disabled = provider.health === 'checking' || !provider.configured

    this.#models(provider)
    this.#detail.says(provider.detail)

    const external = provider.family === 'external'
    this.#key.node.hidden = !external
    this.#keyLine.hidden = !external
    if (external) this.#keyLine.textContent = provider.needsKey ? AI.noKey : AI.stored

    const note = provider.note ?? aiMissing(provider)
    this.#note.hidden = note === null
    if (note) this.#note.textContent = note

    this.#tested(provider)
  }

  /** What it answers with: a list where the service offered one, a line to type where it did not. */
  #models(provider: AiProvider): void {
    const offered = provider.models ?? []
    const kind = offered.length > 0 ? 'list' : 'line'
    const providerId = this.#id
    const model = (name: string): void => this.#emit({ kind: 'ai-model', providerId, model: name })
    if (kind !== this.#modelKind) {
      this.#modelKind = kind
      const built =
        kind === 'list'
          ? new Picker({ label: AI.model, caption: true, empty: AI.pickModel, none: AI.pickModel, pick: model })
          : new Field({ label: AI.model, apply: model })
      if (this.#modelField) this.#modelField.node.replaceWith(built.node)
      else this.#fields.prepend(built.node)
      this.#modelField = built
    }
    if (this.#modelField instanceof Picker) {
      this.#modelField.offers(
        offered.map((name) => ({ value: name, label: name })),
        provider.model || undefined,
      )
    } else this.#modelField?.says(provider.model)
  }

  /** The last real call: what came back and how long it took, or why nothing came. */
  #tested(provider: AiProvider): void {
    const tested = provider.tested
    this.#said.hidden = tested === undefined
    if (!tested) return
    const failed = 'error' in tested
    this.#saidWhen.dataset.tone = failed ? 'bad' : 'good'
    this.#saidWhen.textContent = failed ? tested.error : answeredIn(tested.ms)
    this.#saidText.hidden = failed
    if (!failed) this.#saidText.textContent = tested.reply
  }
}
