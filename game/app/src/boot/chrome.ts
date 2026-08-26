import { iconMarkup, isIcon, type IconName } from './icons.ts'

/**
 * The pieces every surface of the panel is built from: the chamfered box with
 * its two-layer edge, the button, the chip, and the icon. The look itself is
 * in the stylesheet `index.html` serves; this only builds the shapes it draws.
 */

/** How deep the corners are cut, by what the thing is. */
export type Cut = 'c14' | 'c10' | 'c6' | 'c4'

/** Fill every icon slot the markup declares: `<span class="gb-i" data-icon="city">`. */
export function paintIcons(root: ParentNode): void {
  for (const slot of root.querySelectorAll<HTMLElement>('[data-icon]')) {
    const name = slot.dataset.icon ?? ''
    if (isIcon(name)) slot.innerHTML = iconMarkup(name)
  }
}

export function icon(name: IconName, size?: 14 | 16 | 28): HTMLSpanElement {
  const made = document.createElement('span')
  made.className = size ? `gb-i gb-i-${size}` : 'gb-i'
  made.innerHTML = iconMarkup(name)
  return made
}

/**
 * A box with a lit hairline round it. A border cannot follow a chamfer, so the
 * edge is the outer element and the ground is an inner one inset by a pixel;
 * everything goes inside the layer this returns as `inner`.
 */
export function edged(tag: 'div' | 'li' | 'span', className: string, cut: Cut): { box: HTMLElement; inner: HTMLElement } {
  const box = document.createElement(tag)
  box.className = `${className} gb-${cut} gb-edged`
  const inner = document.createElement(tag === 'li' ? 'div' : 'span')
  inner.className = `${className}-in`
  box.append(inner)
  return { box, inner }
}

/** A button: the edge, the ground, an icon and the words. */
export function button(input: {
  text: string
  icon: IconName
  label?: string
  tooltip?: string
  hint?: string
  lit?: boolean
  quiet?: boolean
  onClick: () => void
}): HTMLButtonElement {
  const made = document.createElement('button')
  made.type = 'button'
  made.className = 'gb-btn gb-c6'
  if (input.lit) made.dataset.lit = 'true'
  if (input.quiet) made.dataset.quiet = 'true'
  if (input.label) made.setAttribute('aria-label', input.label)
  if (input.tooltip) made.dataset.tooltip = input.tooltip
  if (input.hint) made.dataset.hint = input.hint
  const inner = document.createElement('span')
  const textSpan = document.createElement('span')
  textSpan.className = 'gb-btn-text'
  textSpan.textContent = input.text
  inner.append(icon(input.icon, 16), textSpan)
  made.append(inner)
  made.addEventListener('click', input.onClick)
  return made
}

/** A chip: a short state in its own colour. */
export function chip(text: string, className: string): HTMLSpanElement {
  const made = document.createElement('span')
  made.className = `gb-chip gb-cut gb-c4 gb-t0 ${className}`
  made.textContent = text
  return made
}

/** A line of text at one of the type steps. */
export function line(className: string, text: string): HTMLSpanElement {
  const made = document.createElement('span')
  made.className = className
  made.textContent = text
  return made
}
