import { el, setText } from '../dom.ts'
import { rise } from '../motion.ts'
import type { TalkTurn } from '../types.ts'

/**
 * The conversation so far, oldest at the top, the turn in front of the player
 * at the bottom. A turn keeps its node for as long as it is on the transcript,
 * so a reply arriving word by word is written into the node already there and
 * nothing above it moves. It scrolls inside a frame that never changes size.
 */
export class Transcript {
  readonly node = el('ol', 'gb-transcript gb-scrolls')
  #rows: TurnRow[] = []

  constructor() {
    this.node.setAttribute('aria-live', 'polite')
    this.node.setAttribute('aria-label', 'Conversation so far')
  }

  render(turns: readonly TalkTurn[], speaker?: string): void {
    const speakerName = speaker ? speaker.split(' ')[0]! : 'Delia'
    let keep = 0
    while (keep < turns.length && keep < this.#rows.length && this.#rows[keep]!.who === turns[keep]!.who) keep += 1
    for (const row of this.#rows.splice(keep)) row.node.remove()
    for (let at = keep; at < turns.length; at += 1) {
      const row = new TurnRow(turns[at]!.who)
      this.#rows.push(row)
      this.node.append(row.node)
    }
    turns.forEach((turn, at) => this.#rows[at]!.write(turn, speakerName))
    this.node.scrollTop = this.node.scrollHeight
  }

  clear(): void {
    this.#rows = []
    this.node.replaceChildren()
  }
}

class TurnRow {
  readonly node = el('li', 'gb-turn gb-t3')
  readonly who: TalkTurn['who']
  #name = el('span', 'gb-turn-name gb-t1')
  #does = el('p', 'gb-does')
  #says = el('p', 'gb-says')

  constructor(who: TalkTurn['who']) {
    this.who = who
    this.node.dataset.who = who
    rise(this.node, 0)
    this.#does.hidden = true
    this.node.append(this.#name, this.#does, this.#says)
  }

  write(turn: TalkTurn, speakerName: string): void {
    const label = this.who === 'you' ? 'You' : speakerName
    setText(this.#name, label)
    setText(this.#does, turn.does ?? '')
    this.#does.hidden = !turn.does
    setText(this.#says, turn.says)
  }
}
