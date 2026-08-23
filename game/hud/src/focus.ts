import { focusables } from './dom.ts'

/**
 * Where the keyboard was before a window took it, so closing the window hands
 * it straight back. Nothing to give it back to means the game gets it: focus
 * drops to the page and the game's own listeners hear the next key.
 */
export class FocusReturn {
  #from: HTMLElement | undefined

  /** Call before the window takes focus. */
  remember(node: HTMLElement): void {
    const active = node.ownerDocument.activeElement
    const body = node.ownerDocument.body
    this.#from = active instanceof HTMLElement && active !== body ? active : undefined
  }

  /** Call as the window lets go. */
  restore(node: HTMLElement): void {
    const back = this.#from
    this.#from = undefined
    const doc = node.ownerDocument
    const inside = doc.activeElement instanceof HTMLElement && node.contains(doc.activeElement)
    if (back?.isConnected && !node.contains(back)) back.focus()
    else if (inside) (doc.activeElement as HTMLElement).blur()
  }
}

/**
 * Step round a ring of stops. Returns false when the ring is empty, which lets
 * the key carry on to whatever else wanted it.
 */
export function cycleFocus(stops: readonly HTMLElement[], back: boolean): boolean {
  const first = stops[0]
  const last = stops[stops.length - 1]
  if (!first || !last) return false

  const active = first.ownerDocument.activeElement
  const at = active instanceof HTMLElement ? stops.indexOf(active) : -1
  const next = at === -1 ? (back ? last : first) : stops[(at + (back ? -1 : 1) + stops.length) % stops.length]
  next?.focus()
  return true
}

/** Keep Tab inside an open window: the ring is everything focusable in it. */
export function trapTab(root: HTMLElement, back: boolean): boolean {
  return cycleFocus(focusables(root), back)
}
