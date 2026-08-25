import { el, kbd } from '../dom.ts'
import { ICON_PX, icon, type IconName } from './icon.ts'

/** What a button says and does. Lit is the one thing to do here; everything else is quiet. */
export interface ActInput {
  readonly label: string
  readonly icon?: IconName
  readonly key?: string
  readonly lit?: boolean
  readonly className?: string
  /** What a screen reader says. Needed whenever the words on it are not the whole story. */
  readonly aria?: string
  /** An icon and a key cap with no words: the close button, and nothing else. */
  readonly quiet?: boolean
}

/**
 * One button, everywhere. Chamfered, edged, with its icon on the left and the
 * key that does the same thing on the right, so nothing on screen can only be
 * reached one way.
 */
export function act(input: ActInput): HTMLButtonElement {
  const node = el('button', ['gb-act gb-cut gb-edged', input.lit ? 'gb-act-lit' : '', input.className ?? ''].join(' ').trim())
  node.type = 'button'
  if (input.aria) node.setAttribute('aria-label', input.aria)
  if (input.icon) node.append(icon(input.icon, ICON_PX.button))
  if (!input.quiet) node.append(el('span', 'gb-t1', input.label))
  if (input.key) node.append(kbd(input.key))
  return node
}

/** The way out of whatever is in front of the player, with its key on it. */
export function closeButton(key: string, aria: string): HTMLButtonElement {
  return act({ label: 'Close', icon: 'close', key, aria, quiet: true, className: 'gb-close' })
}
