import { el } from '../dom.ts'
import { act } from './act.ts'
import type { IconName } from './icon.ts'

/** The button beside a field, for a value that is reported by hand. */
export interface FieldButton {
  readonly label: string
  readonly icon: IconName
}

export interface FieldInput {
  /** The caption over the box, and what a screen reader calls it. */
  readonly label: string
  readonly placeholder?: string
  /** A secret: never drawn back, and cleared the moment it is reported. */
  readonly secret?: boolean
  readonly button?: FieldButton
  /** What was typed, once the player is done typing it. */
  readonly apply: (value: string) => void
}

/**
 * One line the player types into: a caption, the box, and a button where the
 * value is handed over by hand. Enter reports it and so does walking away from
 * it, so nothing here can only be reached one way.
 *
 * A field decides nothing. It reports what was typed and waits to be told what
 * the value is now; a secret one is write only, so it holds nothing after it
 * has reported and never draws a value back.
 */
export class Field {
  readonly node = el('div', 'gb-ai-field')
  #box = el('input', 'gb-field gb-cut gb-edged gb-t2')
  #apply: (value: string) => void
  #secret: boolean
  #pushed = ''

  constructor(input: FieldInput) {
    this.#apply = input.apply
    this.#secret = input.secret === true
    this.#box.type = this.#secret ? 'password' : 'text'
    if (input.placeholder) this.#box.placeholder = input.placeholder
    const label = el('label', 'gb-ai-label')
    label.append(el('span', 'gb-t1', input.label), this.#box)
    this.node.append(label)
    if (input.button) {
      const button = act({ label: input.button.label, icon: input.button.icon })
      button.addEventListener('click', () => this.#report())
      this.node.append(button)
    }
    this.#box.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.#report()
    })
    this.#box.addEventListener('change', () => this.#report())
  }

  /** The value the game pushed. A box the player is typing in is left alone. */
  says(value: string): void {
    this.#pushed = value
    if (this.#secret || this.node.ownerDocument.activeElement === this.#box) return
    if (this.#box.value !== value) this.#box.value = value
  }

  #report(): void {
    const value = this.#box.value.trim()
    if (!value) return
    if (this.#secret) {
      this.#box.value = ''
      this.#apply(value)
      return
    }
    if (value === this.#pushed) return
    // What was reported is what the game has been told, so walking away from
    // the box after Enter does not report the same line twice.
    this.#pushed = value
    this.#apply(value)
  }
}

/** One thing on offer in a picker: what goes out, and what it reads as. */
export interface PickerOption {
  readonly value: string
  readonly label: string
}

export interface PickerInput {
  /** What a screen reader calls it, and the caption when it wears one. */
  readonly label: string
  /** Draw the caption over the box. A picker inside a row already has its title. */
  readonly caption?: boolean
  /** What it reads with nothing picked yet. */
  readonly empty: string
  /** What it reads when there is nothing to pick at all. */
  readonly none: string
  readonly pick: (value: string) => void
}

/** A list to pick one thing from: the same field, with the choices already written. */
export class Picker {
  readonly node = el('div', 'gb-ai-field')
  #box = el('select', 'gb-pick gb-cut gb-t2')
  #empty: string
  #none: string
  #key = ''

  constructor(input: PickerInput) {
    this.#empty = input.empty
    this.#none = input.none
    this.#box.setAttribute('aria-label', input.label)
    const label = el('label', 'gb-ai-label')
    if (input.caption) label.append(el('span', 'gb-t1', input.label))
    label.append(this.#box)
    this.node.append(label)
    this.#box.addEventListener('change', () => {
      if (this.#box.value) input.pick(this.#box.value)
    })
  }

  /** What there is to pick from, and which one is picked. Rebuilt only when it changed. */
  offers(options: readonly PickerOption[], chosen: string | undefined): void {
    const key = `${options.map((one) => `${one.value}=${one.label}`).join('|')}::${chosen ?? ''}`
    if (key === this.#key) return
    this.#key = key
    const nodes: HTMLOptionElement[] = []
    if (!chosen || options.length === 0) {
      const blank = el('option', undefined, options.length === 0 ? this.#none : this.#empty)
      blank.value = ''
      blank.disabled = true
      blank.selected = true
      nodes.push(blank)
    }
    for (const one of options) {
      const node = el('option', undefined, one.label)
      node.value = one.value
      node.selected = one.value === chosen
      nodes.push(node)
    }
    this.#box.replaceChildren(...nodes)
    this.#box.value = chosen ?? ''
    this.#box.disabled = options.length === 0
  }
}
