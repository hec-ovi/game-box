import type { Objective } from '@gb/quest'
import type { Target } from './targets.ts'

export interface HudHandlers {
  /** The player typed a line to whoever they are talking to. */
  onSay(text: string): void
  /** Focus moved into or out of the text box. */
  onTyping(typing: boolean): void
}

/**
 * Everything the player reads: what they are meant to be doing, what they are
 * looking at, what they are carrying, and what the person in front of them is
 * saying. Plain DOM over the canvas, because it is text.
 */
export class Hud {
  #root: HTMLDivElement
  #objectives: HTMLUListElement
  #purse: HTMLDivElement
  #prompt: HTMLDivElement
  #toast: HTMLDivElement
  #talk: HTMLDivElement
  #speaker: HTMLHeadingElement
  #said: HTMLParagraphElement
  #did: HTMLParagraphElement
  #input: HTMLInputElement
  #toastTimer: ReturnType<typeof setTimeout> | undefined

  constructor(mount: HTMLElement, handlers: HudHandlers) {
    this.#root = el('div', 'hud')
    this.#root.innerHTML = `
      <div class="crosshair"></div>
      <div class="objectives"><h2>Objectives</h2><ul></ul></div>
      <div class="purse"><strong>0 coin</strong><ul></ul></div>
      <div class="prompt hidden"><kbd>E</kbd><span></span></div>
      <div class="toast hidden"></div>
      <div class="talk hidden">
        <h3></h3>
        <p class="said"></p>
        <p class="did"></p>
        <input type="text" placeholder="Say something, or press Escape to walk away" />
      </div>`
    mount.appendChild(this.#root)

    this.#objectives = this.#root.querySelector('.objectives ul')!
    this.#purse = this.#root.querySelector('.purse')!
    this.#prompt = this.#root.querySelector('.prompt')!
    this.#toast = this.#root.querySelector('.toast')!
    this.#talk = this.#root.querySelector('.talk')!
    this.#speaker = this.#talk.querySelector('h3')!
    this.#said = this.#talk.querySelector('.said')!
    this.#did = this.#talk.querySelector('.did')!
    this.#input = this.#talk.querySelector('input')!

    this.#input.addEventListener('focus', () => handlers.onTyping(true))
    this.#input.addEventListener('blur', () => handlers.onTyping(false))
    this.#input.addEventListener('keydown', (event) => {
      event.stopPropagation()
      if (event.key !== 'Enter') return
      const text = this.#input.value.trim()
      if (!text) return
      this.#input.value = ''
      handlers.onSay(text)
    })
  }

  showObjectives(objectives: readonly Objective[]): void {
    this.#objectives.replaceChildren(
      ...objectives.map((objective) => {
        const item = el('li')
        item.textContent = objective.text
        const quest = el('span')
        quest.textContent = ` — ${objective.questTitle}`
        item.appendChild(quest)
        return item
      }),
    )
    if (!objectives.length) {
      const empty = el('li')
      empty.textContent = 'Nothing yet. Find someone to talk to.'
      this.#objectives.appendChild(empty)
    }
  }

  showPurse(money: number, carrying: readonly string[]): void {
    this.#purse.querySelector('strong')!.textContent = `${money} coin`
    this.#purse.querySelector('ul')!.replaceChildren(
      ...carrying.map((name) => {
        const item = el('li')
        item.textContent = name
        return item
      }),
    )
  }

  showPrompt(target: Target | undefined): void {
    if (!target) {
      this.#prompt.classList.add('hidden')
      return
    }
    this.#prompt.classList.remove('hidden')
    this.#prompt.querySelector('span')!.textContent = target.label
  }

  say(text: string): void {
    this.#toast.textContent = text
    this.#toast.classList.remove('hidden')
    clearTimeout(this.#toastTimer)
    this.#toastTimer = setTimeout(() => this.#toast.classList.add('hidden'), 3200)
  }

  openTalk(speaker: string): void {
    this.#speaker.textContent = speaker
    this.#said.textContent = ''
    this.#did.textContent = ''
    this.#talk.classList.remove('hidden')
    this.#input.focus()
  }

  appendSaid(text: string): void {
    this.#said.textContent += text
  }

  clearSaid(): void {
    this.#said.textContent = ''
  }

  appendDid(text: string): void {
    this.#did.textContent = this.#did.textContent ? `${this.#did.textContent} · ${text}` : text
  }

  closeTalk(): void {
    this.#talk.classList.add('hidden')
    this.#input.blur()
  }

  get isTalking(): boolean {
    return !this.#talk.classList.contains('hidden')
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}
