/// <reference lib="dom" />

/**
 * How long anything takes, in one place. The stylesheet writes these numbers
 * into its own tokens, so a duration is changed here and both the CSS and the
 * few things JavaScript has to time follow.
 *
 * Nothing over 240 ms for a state change, nothing over 400 ms for a surface
 * arriving, and the veil is the only 400.
 */
export const MS = {
  press: 90,
  state: 140,
  value: 200,
  leave: 200,
  enter: 320,
  veil: 400,
  stagger: 24,
} as const

/** How many items into a list the stagger still delays. Past this they arrive together. */
export const STAGGER_CAP = 8

/** True when the player asked for less movement. Everything then changes at once. */
export function reducedMotion(node: Node): boolean {
  const view = node.ownerDocument?.defaultView
  return view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * Say that a number just climbed: it scales up and comes back on its own inline
 * box, so nothing beside it moves. Restarting the animation needs the browser
 * to see the node without it first, which is what reading the layout forces.
 */
export function bump(node: HTMLElement): void {
  node.removeAttribute('data-bump')
  void node.offsetWidth
  node.dataset.bump = 'true'
}

/** A row arriving in a list: it rises into place, one after the one before it. */
export function rise(node: HTMLElement, index: number): void {
  node.classList.add('gb-enter')
  node.style.setProperty('--i', String(Math.min(index, STAGGER_CAP - 1)))
}
