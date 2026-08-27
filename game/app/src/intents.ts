import type { Hud, HudIntent } from '@gb/hud'
import type { QuestLog } from '@gb/quest'
import type { Ai } from './ai.ts'
import type { Chart } from './chart.ts'
import type { CityMap } from './citymap.ts'
import type { Conditions } from './conditions.ts'
import type { Counters } from './counters.ts'
import type { Inspect } from './inspecting.ts'
import type { Machines } from './machines.ts'
import type { Player } from './player.ts'
import type { Readings } from './reading.ts'
import type { Reporting } from './reporting.ts'
import type { Talking } from './talking.ts'
import type { Travel } from './travel.ts'
import type { View } from './view.ts'

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
  #conditions: Conditions
  #machines: Machines
  #counters: Counters
  #travel: Travel
  #view: View | undefined
  #ai: Ai | undefined
  #pause: (on: boolean) => void
  #inspecting: Inspect | undefined
  #citymap: CityMap | undefined
  #readings: Readings | undefined
  #you: (() => { x: number; z: number }) | undefined
  #leave: () => void
  #releasePointer: () => void

  constructor(input: {
    log: QuestLog
    hud: Hud
    talking: Talking
    report: Reporting
    body: Player
    chart: Chart
    conditions: Conditions
    machines: Machines
    counters: Counters
    travel: Travel
    /** What the player set about the screen. Without one, the corner view and full screen do nothing. */
    view?: View
    /** Which AI runs which job. Without one, the settings tab draws none of it and reports none of it. */
    ai?: Ai
    pause?: (on: boolean) => void
    /** Drawing a thing the player opened in the inventory. Without one the panel keeps its icon. */
    inspecting?: Inspect
    /** The city drawn on the map's glass. Without one, the map has no camera to move. */
    citymap?: CityMap
    /** What is known about a thing picked off the map. Without one, picking one says nothing. */
    readings?: Readings
    /** Where the player stands on the city, which is what centring on them means. */
    you?: () => { x: number; z: number }
    /** The way out of the game, which the game itself does not decide. */
    leave: () => void
    releasePointer: () => void
  }) {
    this.#log = input.log
    this.#hud = input.hud
    this.#talking = input.talking
    this.#report = input.report
    this.#body = input.body
    this.#chart = input.chart
    this.#conditions = input.conditions
    this.#machines = input.machines
    this.#counters = input.counters
    this.#travel = input.travel
    this.#view = input.view
    this.#ai = input.ai
    this.#pause = input.pause ?? (() => {})
    this.#inspecting = input.inspecting
    this.#citymap = input.citymap
    this.#readings = input.readings
    this.#you = input.you
    this.#leave = input.leave
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

  /**
   * Open the map from the game rather than from the interface: walking up to a
   * subway entrance is the same as pressing its key, so it goes the same way and
   * the city behind it stands still for it too.
   */
  openMap(): void {
    this.#hud.show({ window: 'map' })
    this.handle({ kind: 'window', window: 'map' })
  }

  handle(intent: HudIntent): void {
    // which AI runs which job, and the providers behind it. The service holds
    // all of it, so the same six go the same way from the launcher's settings
    // and from the tab in game, and either screen reads back what the other saved
    if (this.#ai?.handle(intent)) return
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
        // the survey before the drawing, so the city goes up with its names on
        // it rather than getting them a frame later
        if (intent.window === 'map') this.#chart.draw()
        if (this.#citymap) this.#citymap.open = intent.window === 'map'
        if (intent.window !== null) this.#releasePointer()
        this.#pause(intent.window !== null)
        // nothing is being drawn into the inventory's canvas once it is off screen
        if (intent.window !== 'inventory') this.#inspecting?.closed()
        return
      // a thing opened in the inventory: the game draws every side of it and
      // pushes the views back, so the panel can be turned
      case 'inspect':
        void this.#inspecting?.show(intent.itemId)
        return
      case 'turn':
        this.#inspecting?.turn(intent.yaw, intent.pitch)
        return
      // something picked off the map, by its callout or by its row: the camera
      // goes onto it and the panel beside it says what is known about it
      case 'read': {
        const read = intent.targetId === null ? undefined : this.#readings?.of(intent.targetId)
        this.#citymap?.look(read?.at, read?.districtId)
        this.#hud.show({ reading: read?.reading ?? null })
        return
      }
      // the camera over the city, moved by a tool or its key
      case 'map-move':
        this.#citymap?.move(intent.move, this.#you?.())
        return
      // the settings tab: the same calls P, T and K make, and the tab reads
      // what the clock says back rather than what it asked for
      case 'lock-time':
        this.#set(this.#conditions.lock(intent.locked))
        return
      case 'skip-time':
        this.#set(this.#conditions.nextTime())
        return
      case 'weather':
        this.#set(this.#conditions.setWeather(intent.weather))
        return
      // the view: the corner map is this box's to draw or not, and full screen
      // is the browser's to grant. Neither button reads its own click; both
      // read what the game pushes back, so the answer comes from the change
      case 'minimap':
        if (this.#view) this.#view.minimap = intent.shown
        return
      case 'fullscreen':
        this.#view?.fullscreen(intent.on)
        return
      // the counter: the hud names the offer and this box pays for it, takes
      // the thing and pushes the counter again without it
      case 'buy':
        this.#counters.buy(intent.itemId)
        return
      case 'counter-closed':
        this.#counters.closed()
        return
      // the machine: the word typed at a locked screen, and the score a game
      // on it ended with. The hud holds neither
      case 'unlock':
        this.#machines.unlock(intent.machineId, intent.password)
        return
      case 'score':
        this.#machines.score(intent.machineId, intent.game, intent.score)
        return
      case 'screen-closed':
        this.#machines.closed()
        return
      // the train: the plan comes down, the veil goes up, and the ride puts
      // the player and whoever is with them down at the other station
      case 'travel':
        this.#chart.open = false
        if (this.#citymap) this.#citymap.open = false
        this.#hud.show({ window: null })
        this.#pause(false)
        this.#travel.board(intent.stationId)
        return
      // the interface asks before it reports this, so there is nothing left to
      // confirm here and the other answer is nothing to do
      case 'exit':
        this.#leave()
        return
      case 'stay':
        return
    }
  }

  #set(said: string | undefined): void {
    if (said) this.#report.note(said)
    this.#report.refresh()
  }
}
