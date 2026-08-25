/**
 * Entrances. Everything this panel puts on screen arrives by transform and
 * opacity, because it is drawn over a scene that redraws every frame. The
 * durations, the curve and the collapse under `prefers-reduced-motion` belong
 * to the stylesheet; this only says a thing has just arrived, and takes the
 * hint off again once it has, so nothing is left holding a layer it no longer
 * needs. Nothing here delays a click: the entrance runs after the work.
 */

/** A list arrives one item after another, and stops staggering past this many. */
const STAGGER_CAP = 8

/** A node that has just been built: it plays its entrance as it is put on the page. */
export function enters(element: HTMLElement, index = 0): void {
  element.style.setProperty('--gb-i', String(Math.min(index, STAGGER_CAP - 1)))
  element.classList.add('gb-in')
  element.addEventListener('animationend', () => element.classList.remove('gb-in'), { once: true })
}

/** A node already on the page that is arriving again: the same entrance, played from the start. */
export function replays(element: HTMLElement): void {
  element.classList.remove('gb-in')
  // let the browser see the animation gone, or the same one will not play twice
  void element.offsetWidth
  enters(element)
}
