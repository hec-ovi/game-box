import type { Choice } from '@gb/quest'
import { el } from '../dom.ts'
import type { HudIntent } from '../types.ts'

/**
 * The one step a player finishes by answering: the quest's question in its own
 * words, and a button for each road out of it. Where a road goes is the quest's
 * to keep, so a button says what the player would do and nothing about the far
 * side of it. Only a step the flow is standing on is drawn with these, so a
 * decision that has been made or has not come up cannot be answered at all.
 */
export class ChoiceView {
  readonly node = el('div', 'gb-choice')

  constructor(questId: string, stepId: string, choice: Choice, emit: (intent: HudIntent) => void) {
    const options = el('ul', 'gb-options')
    for (const option of choice.options) {
      const row = el('li')
      const button = el('button', 'gb-option')
      button.type = 'button'
      button.dataset.option = option.key
      button.textContent = option.label
      button.addEventListener('click', () => {
        emit({ kind: 'decide', questId, stepId, optionId: option.key })
      })
      row.append(button)
      options.append(row)
    }
    this.node.append(el('p', 'gb-ask', choice.prompt), options)
  }
}
