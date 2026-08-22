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

/** Write text only when it changed, so a streamed reply never rebuilds its node. */
export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text
}
