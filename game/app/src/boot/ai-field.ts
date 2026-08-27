import { button, icon, line } from './chrome.ts'
import type { IconName } from './icons.ts'

/**
 * The two controls the settings face is built from, in the panel's own idiom:
 * a line the player types into, and a list they pick from. Neither decides
 * anything. Both report what happened and wait to be told what the value is
 * now, so what is on screen is always what the service last said.
 */

export interface FieldInput {
  /** The caption over the box, and what a screen reader calls it. */
  readonly label: string
  readonly placeholder?: string
  /** A secret: never drawn back, and cleared the moment it is reported. */
  readonly secret?: boolean
  /** A button beside it, for a value handed over by hand. */
  readonly button?: { readonly label: string; readonly icon: IconName }
  /** What was typed, once the player is done typing it. */
  readonly apply: (value: string) => void
}

/**
 * One line the player types into. Enter reports it and so does walking away
 * from it, so nothing here can only be reached one way, and neither reports
 * the same line twice.
 */
export class Field {
  readonly node = document.createElement('div')
  #box = document.createElement('input')
  #apply: (value: string) => void
  #secret: boolean
  #pushed = ''

  constructor(input: FieldInput) {
    this.#apply = input.apply
    this.#secret = input.secret === true
    this.node.className = 'gb-set-field'
    this.#box.className = 'gb-set-box gb-t3'
    this.#box.type = this.#secret ? 'password' : 'text'
    this.#box.autocomplete = 'off'
    this.#box.spellcheck = false
    if (input.placeholder) this.#box.placeholder = input.placeholder

    const label = document.createElement('label')
    label.className = 'gb-set-label'
    label.append(line('gb-t1 gb-set-caption', input.label), this.#box)
    this.node.append(label)
    if (input.button) {
      this.node.append(
        button({ text: input.button.label, icon: input.button.icon, label: `${input.button.label}: ${input.label}`, onClick: () => this.#report() }),
      )
    }

    this.#box.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        this.#report()
      }
    })
    this.#box.addEventListener('change', () => this.#report())
  }

  /** The value the service pushed. A box the player is typing in is left alone. */
  says(value: string): void {
    this.#pushed = value
    if (this.#secret || this.node.ownerDocument.activeElement === this.#box) return
    if (this.#box.value !== value) this.#box.value = value
  }

  #report(): void {
    const value = this.#box.value.trim()
    if (!value) return
    if (this.#secret) {
      // written down nowhere: the box is empty again on the same tick it reports
      this.#box.value = ''
      this.#apply(value)
      return
    }
    if (value === this.#pushed) return
    this.#pushed = value
    this.#apply(value)
  }
}

/** One thing on offer: what goes out, and what it reads as. */
export interface PickerOption {
  readonly value: string
  readonly label: string
}

export interface PickerInput {
  readonly label: string
  /** Draw the caption over the box. A row that already carries its title does not. */
  readonly caption?: boolean
  /** What it reads with nothing picked yet. */
  readonly empty: string
  /** What it reads when there is nothing to pick at all. */
  readonly none: string
  readonly pick: (value: string) => void
}

/** A list to pick one thing from. It says what there is even when there is nothing. */
export class Picker {
  readonly node = document.createElement('div')
  #box = document.createElement('select')
  #empty: string
  #none: string
  #key = ''

  constructor(input: PickerInput) {
    this.#empty = input.empty
    this.#none = input.none
    this.node.className = 'gb-set-field'
    this.#box.className = 'gb-set-pick gb-t3'
    this.#box.setAttribute('aria-label', input.label)

    const label = document.createElement('label')
    label.className = 'gb-set-label'
    if (input.caption) label.append(line('gb-t1 gb-set-caption', input.label))
    const arrow = icon('chevron-right', 14)
    arrow.classList.add('gb-set-chevron')
    label.append(this.#box, arrow)
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
      const blank = document.createElement('option')
      blank.value = ''
      blank.disabled = true
      blank.selected = true
      blank.textContent = options.length === 0 ? this.#none : this.#empty
      nodes.push(blank)
    }
    for (const one of options) {
      const node = document.createElement('option')
      node.value = one.value
      node.textContent = one.label
      node.selected = one.value === chosen
      nodes.push(node)
    }
    this.#box.replaceChildren(...nodes)
    this.#box.value = chosen ?? ''
    this.#box.disabled = options.length === 0
  }
}
