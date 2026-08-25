/// <reference lib="dom" />
// The hud is the only box that touches the DOM, so it asks for the DOM library
// here rather than the workspace asking for it everywhere.

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** The same for the map, which is drawn rather than laid out. */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value))
  return node
}

/** Write text only when it changed, so a streamed reply never rebuilds its node. */
export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text
}

/** A key cap: the key the player presses, written where they can see it. */
export function kbd(key: string): HTMLElement {
  return el('kbd', 'gb-cut gb-edged', key)
}

/** Every element inside that the player can tab to, in tab order. */
export function focusables(root: HTMLElement): HTMLElement[] {
  const found = root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]')
  return [...found].filter((node) => !node.hasAttribute('disabled') && node.getAttribute('tabindex') !== '-1')
}
