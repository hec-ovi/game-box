/**
 * Is something else on the page taking what the player types? The game binds
 * its keys on the document, so without asking this, typing "quiet coastal
 * town" into the panel's own theme box turns the clock over twice and toggles
 * the weather on the way past. `@gb/hud` holds the same rule for its own
 * listener; this is the game's half of it.
 */
export function typingSomewhere(): boolean {
  const element = document.activeElement
  if (!(element instanceof HTMLElement)) return false
  return element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
}
