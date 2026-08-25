import { el } from '../dom.ts'
import { MAIN_TAG } from '../phrase.ts'
import { ICON_PX, icon, type IconName } from './icon.ts'

/** What a chip says about the thing it sits on. The colour is the meaning. */
export type ChipTone = 'main' | 'good' | 'warn' | 'bad' | 'accent' | 'quiet'

/**
 * A word about a thing, in the colour of what it says: Main, Done, Failed,
 * Quest, Here. Its edge takes its own colour, so one chip cannot read as two.
 */
export function chip(text: string, tone: ChipTone = 'quiet', name?: IconName): HTMLElement {
  const node = el('span', `gb-chip gb-cut gb-edged gb-t1${tone === 'quiet' ? '' : ` gb-chip-${tone}`}`)
  if (name) node.append(icon(name, ICON_PX.line))
  node.append(el('span', undefined, text))
  return node
}

/** The story, marked in brass wherever it is listed. It is never a general highlight. */
export function mainChip(): HTMLElement {
  return chip(MAIN_TAG, 'main')
}
