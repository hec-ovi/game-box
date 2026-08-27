import { el, setText } from '../dom.ts'
import { AI, AI_HEALTH, aiMissing, answeredIn } from '../phrase.ts'
import type { AiHealth, AiProvider, HudIntent } from '../types.ts'
import { act } from '../ui/act.ts'
import { chip, type ChipTone } from '../ui/chip.ts'
import { Field, Picker } from '../ui/field.ts'
import { ICON_PX, icon, type IconName } from '../ui/icon.ts'
import { Row } from '../ui/row.ts'

/** How a provider stands, in the colour of what it says. */
const HEALTH_TONE: Record<AiHealth, ChipTone> = {
  unknown: 'quiet',
  checking: 'accent',
  ok: 'good',
  failed: 'bad',
}

/** A service out on the net, or a server on this machine. */
const FAMILY_ICON = { external: 'cloud', local: 'screen' } as const satisfies Record<string, IconName>

/**
 * One provider: what it is called over the model it answers with, how it
 * stands, what can be asked of it, and the fields it needs. Everything typed
 * here goes out as an intent and the row reads what the game pushes back, so a
 * key is stored once the game says it is and not before.
 */
export class ProviderRow {
  readonly node = el('article', 'gb-ai-provider')
  #emit: (intent: HudIntent) => void
  #id: string
  #row = new Row({ icon: 'cloud', title: '' })
  #fields = el('div', 'gb-ai-fields')
  #model: Field | Picker | undefined
  #modelKind = ''
  #detail: Field
  #key: Field
  #keyLine = el('p', 'gb-ai-note gb-t2')
  #note = el('p', 'gb-ai-note gb-t2')
  #said = el('div', 'gb-ai-said')
  #saidWhen = el('p', 'gb-t2')
  #saidText = el('p', 'gb-ai-said-text gb-t2')
  #check = act({ label: AI.check, icon: 'check' })
  #test = act({ label: AI.test, icon: 'screen' })
  /** What is on the row already, so a push that did not touch it does not redraw it. */
  #drawn = ''

  constructor(provider: AiProvider, emit: (intent: HudIntent) => void) {
    this.#emit = emit
    this.#id = provider.id
    const providerId = provider.id
    this.#detail = new Field({
      label: provider.family === 'local' ? AI.host : AI.url,
      apply: (detail) => emit({ kind: 'ai-detail', providerId, detail }),
    })
    this.#key = new Field({
      label: AI.key,
      placeholder: AI.typeKey,
      secret: true,
      button: { label: AI.store, icon: 'lock' },
      apply: (secret) => emit({ kind: 'ai-key', providerId, secret }),
    })
    this.#check.addEventListener('click', () => emit({ kind: 'ai-health', providerId }))
    this.#test.addEventListener('click', () => emit({ kind: 'ai-test', providerId }))
    this.#row.act(this.#check)
    this.#row.act(this.#test)
    this.#said.append(this.#saidWhen, this.#saidText)
    this.#fields.append(this.#detail.node, this.#key.node, this.#keyLine, this.#note, this.#said)
    this.node.append(this.#row.node, this.#fields)
    this.render(provider)
  }

  render(provider: AiProvider): void {
    const key = JSON.stringify(provider)
    if (key === this.#drawn) return
    this.#drawn = key
    this.#row.tile.replaceChildren(icon(FAMILY_ICON[provider.family], ICON_PX.tile))
    this.#row.says(provider.label, provider.model)
    this.#row.keyLine(provider.health === 'ok' ? 'on' : provider.health === 'failed' ? 'bad' : null)
    this.#row.state.replaceChildren(chip(AI_HEALTH[provider.health], HEALTH_TONE[provider.health]))
    this.#check.disabled = provider.health === 'checking'
    this.#test.disabled = provider.health === 'checking' || !provider.configured

    this.#models(provider)
    this.#detail.says(provider.detail)

    const external = provider.family === 'external'
    this.#key.node.hidden = !external
    this.#keyLine.hidden = !external
    if (external) setText(this.#keyLine, provider.needsKey ? AI.noKey : AI.stored)

    const note = provider.note ?? aiMissing(provider)
    this.#note.hidden = note === null
    if (note) setText(this.#note, note)

    this.#tested(provider)
  }

  /** What it answers with: a list where the game offers one, a line to type where it does not. */
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
      if (this.#model) this.#model.node.replaceWith(built.node)
      else this.#fields.prepend(built.node)
      this.#model = built
    }
    if (this.#model instanceof Picker) {
      this.#model.offers(
        offered.map((name) => ({ value: name, label: name })),
        provider.model || undefined,
      )
    } else this.#model?.says(provider.model)
  }

  /** The last real call: what came back and how long it took, or why nothing came. */
  #tested(provider: AiProvider): void {
    const tested = provider.tested
    this.#said.hidden = tested === undefined
    if (!tested) return
    const failed = 'error' in tested
    this.#saidWhen.className = `gb-t2 ${failed ? 'gb-ai-said-bad' : 'gb-ai-said-when'}`
    setText(this.#saidWhen, failed ? tested.error : answeredIn(tested.ms))
    this.#saidText.hidden = failed
    if (!failed) setText(this.#saidText, tested.reply)
  }
}
