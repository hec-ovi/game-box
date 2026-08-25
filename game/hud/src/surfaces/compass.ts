import { el, setText } from '../dom.ts'
import { CARDINALS, distanceText } from '../phrase.ts'
import { Reveal } from '../reveal.ts'
import { LAYOUT } from '../style/layout.ts'
import type { CompassView, HudState } from '../types.ts'
import type { Surface } from './surface.ts'

/** Pixels per degree on the strip: 120 degrees of arc across its width. */
const PX_PER_DEG = LAYOUT.compass.width / 120

/** How far either side of centre the strip shows before a mark pins to the edge. */
const HALF_ARC = 60

/** A tick every fifteen degrees. */
const TICK_EVERY = 15

/** The track carries a turn and a half so every facing has ticks to both edges. */
const TRACK = { from: -180, to: 540 } as const

/**
 * Which way to go, without pressing a key: the points of the compass slide
 * as the player turns, the tracked goal's mark sits at its bearing and pins
 * to an edge while it is behind them, and the line under it says what and
 * how far. The game pushes the facing and what its guide resolved.
 */
export class CompassSurface implements Surface {
  readonly node = el('section', 'gb-compass')
  #track = el('div', 'gb-compass-track')
  #mark = el('div', 'gb-compass-mark')
  #where = el('p', 'gb-compass-where')
  #what = el('span', 'gb-what')
  #far = el('span', 'gb-num')
  #reveal: Reveal

  constructor() {
    this.node.setAttribute('aria-label', 'Compass')
    const strip = el('div', 'gb-compass-strip')
    this.#track.style.width = `${(TRACK.to - TRACK.from) * PX_PER_DEG}px`
    for (let deg = TRACK.from; deg <= TRACK.to; deg += TICK_EVERY) this.#track.append(tick(deg))
    this.#mark.hidden = true
    strip.append(this.#track, this.#mark)
    this.#where.append(this.#what, this.#far)
    this.node.append(strip, this.#where)
    this.#reveal = new Reveal(this.node)
  }

  render(state: HudState): void {
    const compass = state.compass
    if (compass) this.#draw(compass)
    this.#reveal.set(compass !== undefined)
  }

  dispose(): void {
    this.#reveal.dispose()
  }

  #draw(compass: CompassView): void {
    const centre = LAYOUT.compass.width / 2
    const facing = degrees(compass.facing)
    this.#track.style.transform = `translateX(${centre - (facing - TRACK.from) * PX_PER_DEG}px)`
    const goal = compass.goal
    this.#mark.hidden = goal === undefined
    this.#where.hidden = goal === undefined
    if (!goal) {
      setText(this.#what, '')
      setText(this.#far, '')
      return
    }
    const relative = wrap(degrees(goal.bearing) - facing)
    const shown = Math.max(-HALF_ARC, Math.min(HALF_ARC, relative))
    this.#mark.style.left = `${centre + shown * PX_PER_DEG}px`
    this.#mark.dataset.line = goal.line ?? 'side'
    if (shown === relative) delete this.#mark.dataset.edge
    else this.#mark.dataset.edge = relative < 0 ? 'left' : 'right'
    this.#mark.setAttribute('aria-label', goal.label)
    this.#where.dataset.line = goal.line ?? 'side'
    setText(this.#what, goal.label)
    setText(this.#far, distanceText(goal.distance))
  }
}

/**
 * One tick of the track at a bearing; every ninety degrees it is a point of
 * the compass, which the stylesheet writes from the attribute so the strip
 * holds no text of its own.
 */
function tick(deg: number): HTMLElement {
  const node = el('div', 'gb-compass-tick')
  node.style.left = `${(deg - TRACK.from) * PX_PER_DEG}px`
  const turn = ((deg % 360) + 360) % 360
  if (turn % 90 === 0) node.dataset.point = CARDINALS[turn / 90]
  return node
}

/** Radians clockwise from north as degrees, 0 to 360. */
function degrees(radians: number): number {
  return (((radians * 180) / Math.PI) % 360 + 360) % 360
}

/** The short way round: -180 to 180. */
function wrap(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180
}
