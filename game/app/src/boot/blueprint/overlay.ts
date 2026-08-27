import { icon } from '../chrome.ts'
import type { Plan } from '../../blueprint/plan.ts'

/** Something with a name written over it in the view: where it stands, in metres. */
export interface Anchor {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Where a name landed on the glass, and whether it is in front of the camera at all. */
export interface Placed {
  readonly x: number
  readonly y: number
  readonly ahead: boolean
}

interface Handlers {
  leave(): void
  fit(): void
  read(zoneId: string | undefined): void
}

/**
 * Everything read over the drawing: what city this is and the way back, the
 * parts of town as a list you can pick one out of, their names written across
 * the view where the map writes them, and what the plan came out as.
 *
 * The look is the panel's, so this holds no colour of its own: the classes are
 * styled beside the rest of the front door in `index.html`.
 */
export class Overlay {
  readonly root = document.createElement('div')
  readonly glass = document.createElement('canvas')
  readonly anchors: Anchor[] = []
  #names = document.createElement('div')
  #labels = new Map<string, HTMLElement>()
  #rows = new Map<string, HTMLElement>()
  #handlers: Handlers

  constructor(input: { plan: Plan; handlers: Handlers }) {
    this.#handlers = input.handlers
    this.root.className = 'gb-bp'
    this.glass.className = 'gb-bp-glass'
    this.#names.className = 'gb-bp-names'
    this.#names.setAttribute('aria-hidden', 'true')
    this.root.append(this.glass, this.#names, this.#crown(input.plan), this.#zones(input.plan), this.#foot(input.plan))
    this.#name(input.plan)
  }

  /** Where each name goes on the glass this frame. */
  place(id: string, at: Placed): void {
    const label = this.#labels.get(id)
    if (!label) return
    label.hidden = !at.ahead
    if (at.ahead) label.style.transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y)}px, 0) translate(-50%, -50%)`
  }

  /** Which part of town is being read: its row and its name light, the rest step back. */
  read(zoneId: string | undefined): void {
    for (const [id, row] of this.#rows) row.dataset.read = String(id === zoneId)
    for (const [id, label] of this.#labels) label.dataset.read = String(zoneId === undefined || id === zoneId)
    this.#handlers.read(zoneId)
  }

  dispose(): void {
    this.root.remove()
    this.#labels.clear()
    this.#rows.clear()
  }

  #crown(plan: Plan): HTMLElement {
    const crown = document.createElement('header')
    crown.className = 'gb-bp-crown'

    const headings = document.createElement('div')
    headings.className = 'gb-bp-headings'
    const eyebrow = document.createElement('span')
    eyebrow.className = 'gb-t1 gb-bp-eyebrow'
    eyebrow.append(icon('city', 14), text('span', '', 'The architecture, before anything is written into it'))
    const title = document.createElement('h2')
    title.className = 'gb-t6 gb-bp-title'
    title.textContent = plan.name
    headings.append(title, eyebrow)

    crown.append(headings, this.#leave())
    return crown
  }

  #leave(): HTMLButtonElement {
    const leave = document.createElement('button')
    leave.type = 'button'
    leave.className = 'gb-hud-btn gb-c6 gb-bp-leave'
    leave.append(icon('back', 16), text('span', '', 'Back to the brief'), text('span', 'gb-bp-cap gb-cut gb-c4', 'Esc'))
    leave.addEventListener('click', () => this.#handlers.leave())
    return leave
  }

  #zones(plan: Plan): HTMLElement {
    const box = document.createElement('aside')
    box.className = 'gb-bp-zones gb-c10 gb-edged'
    const inner = document.createElement('div')
    inner.className = 'gb-bp-zones-in'
    inner.append(text('span', 'gb-t1 gb-bp-zones-head', `${plan.zones.length} ${plan.zones.length === 1 ? 'zone' : 'zones'}`))

    const list = document.createElement('ul')
    list.className = 'gb-bp-zone-list'
    for (const zone of plan.zones) {
      const row = document.createElement('li')
      row.className = 'gb-bp-zone gb-c6'
      row.dataset.read = 'false'
      const pick = document.createElement('button')
      pick.type = 'button'
      pick.className = 'gb-bp-zone-pick'
      pick.append(
        text('span', 'gb-bp-zone-tile gb-c4', ''),
        text('span', 'gb-t4 gb-bp-zone-name', zone.name),
        text('span', 'gb-bp-zone-count', String(zone.buildings)),
      )
      pick.querySelector('.gb-bp-zone-tile')!.append(icon('map', 16))
      pick.addEventListener('pointerenter', () => this.read(zone.id))
      pick.addEventListener('focus', () => this.read(zone.id))
      pick.addEventListener('pointerleave', () => this.read(undefined))
      pick.addEventListener('blur', () => this.read(undefined))
      row.append(pick)
      list.append(row)
      this.#rows.set(zone.id, row)
    }
    inner.append(list)
    box.append(inner)
    return box
  }

  #foot(plan: Plan): HTMLElement {
    const foot = document.createElement('footer')
    foot.className = 'gb-bp-foot'

    const readouts = document.createElement('div')
    readouts.className = 'gb-bp-readouts'
    const across = Math.round(plan.ground.w)
    const down = Math.round(plan.ground.d)
    for (const [value, label] of [
      [String(plan.buildings.length), 'Buildings'],
      [String(plan.zones.length), 'Zones'],
      [String(plan.stations.length), 'Stations'],
      [`${plan.tallest}`, 'Tallest, storeys'],
      [`${across} x ${down}`, 'Metres across'],
    ] as const) {
      const item = document.createElement('div')
      item.className = 'gb-bp-readout'
      item.append(text('span', 'gb-bp-readout-num', value), text('span', 'gb-t1 gb-bp-readout-lbl', label))
      readouts.append(item)
    }

    const keys = document.createElement('ul')
    keys.className = 'gb-bp-keys'
    for (const [key, does] of [
      ['Drag', 'turn'],
      ['Wheel', 'zoom'],
      ['Right drag', 'pan'],
    ] as const) {
      const item = document.createElement('li')
      item.append(text('span', 'gb-bp-cap gb-cut gb-c4', key), text('span', 'gb-t1 gb-bp-key-does', does))
      keys.append(item)
    }

    const fit = document.createElement('button')
    fit.type = 'button'
    fit.className = 'gb-hud-btn gb-c6 gb-bp-fit'
    fit.append(icon('map', 16), text('span', '', 'Whole city'))
    fit.addEventListener('click', () => this.#handlers.fit())

    foot.append(readouts, keys, fit)
    return foot
  }

  /** A name over every part of town and every station, the way the map writes them. */
  #name(plan: Plan): void {
    for (const zone of plan.zones) this.#label(zone.id, 'zone', zone.name, { x: zone.heart.x, y: zone.top, z: zone.heart.z })
    for (const station of plan.stations) {
      this.#label(station.id, 'station', station.name, { x: station.x + station.w / 2, y: station.top, z: station.z + station.d / 2 })
    }
  }

  #label(id: string, kind: 'zone' | 'station', name: string, at: { x: number; y: number; z: number }): void {
    const label = document.createElement('span')
    label.className = `gb-bp-name gb-bp-name-${kind} gb-t1`
    label.dataset.read = 'true'
    label.textContent = name
    this.#names.append(label)
    this.#labels.set(id, label)
    this.anchors.push({ id, ...at })
  }
}

function text(tag: 'span' | 'p', className: string, words: string): HTMLElement {
  const made = document.createElement(tag)
  if (className) made.className = className
  made.textContent = words
  return made
}
