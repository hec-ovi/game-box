import type { Hud, HudIntent } from '@gb/hud'
import type { QuestLog } from '@gb/quest'
import type { Chart } from './chart.ts'
import type { Player } from './player.ts'
import type { Reporting } from './reporting.ts'
import type { Talking } from './talking.ts'

/**
 * What the player did in the interface, carried to whoever owns it. `@gb/hud`
 * holds no state and decides nothing: everything it reports is handed to the
 * box with the rule in it, and whatever that box says comes back as a push.
 */
export class Intents {
  #log: QuestLog
  #hud: Hud
  #talking: Talking
  #report: Reporting
  #body: Player
  #chart: Chart
  #releasePointer: () => void

  constructor(input: {
    log: QuestLog
    hud: Hud
    talking: Talking
    report: Reporting
    body: Player
    chart: Chart
    releasePointer: () => void
  }) {
    this.#log = input.log
    this.#hud = input.hud
    this.#talking = input.talking
    this.#report = input.report
    this.#body = input.body
    this.#chart = input.chart
    this.#releasePointer = input.releasePointer
  }

  /**
   * Something on the page took the keyboard, or gave it back. The panel is in
   * front of everything, so whatever the interface had open goes with the keys:
   * Escape and Tab belong to what the player can actually see, and a window
   * left standing behind the panel takes both.
   */
  handOver(away: boolean): void {
    this.#body.setTyping(away)
    if (away) this.#hud.show({ window: null })
  }

  handle(intent: HudIntent): void {
    switch (intent.kind) {
      case 'say':
        void this.#talking.say(intent.text)
        return
      // the same answer given by clicking instead of typing: the key is the
      // conversation's own, and goes straight back to it
      case 'choose':
        void this.#talking.choose(intent.key)
        return
      case 'typing':
        this.#body.setTyping(intent.typing)
        return
      case 'talk-closed':
        this.#talking.end()
        return
      // the interface holds no state of its own, so the quest it was told to
      // follow is echoed straight back to it
      case 'track':
        this.#report.track(intent.questId)
        return
      // giving up on a job. The hud asks twice on its own before it reports
      // this, so there is nothing left to confirm here, and it takes nothing
      // off the board itself: the list goes back without the quest on it
      case 'abandon':
        this.#report.report(this.#log.abandon(intent.questId))
        return
      // a fork in a job. The question and the roads out of it are the quest's
      // own words; what comes back is the key of the one the player took
      case 'decide':
        this.#report.report(
          this.#log.handle({ kind: 'chose', questId: intent.questId, stepId: intent.stepId, optionId: intent.optionId }),
        )
        return
      // the map is measured while it is being read and at no other time, and a
      // window the player has to click needs the pointer back
      case 'window':
        this.#chart.open = intent.window === 'map'
        if (intent.window !== null) this.#releasePointer()
        return
    }
  }
}
