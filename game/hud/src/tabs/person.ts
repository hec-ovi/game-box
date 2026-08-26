import { el } from '../dom.ts'
import { DISPOSITION, LOCKED_FACT, factsKnown } from '../phrase.ts'
import type { CodexFact, CodexPerson } from '../types.ts'
import { chip, type ChipTone } from '../ui/chip.ts'
import { ICON_PX, icon } from '../ui/icon.ts'
import { Row } from '../ui/row.ts'

/** Five standings, three colours: against is warned, for is brass, neutral is quiet. */
const TONE: Record<CodexPerson['disposition'], ChipTone> = {
  hostile: 'bad',
  cool: 'warn',
  neutral: 'quiet',
  warm: 'main',
  friendly: 'main',
}

/**
 * One person in the codex: their name, how they stand towards the player,
 * what they do, and every fact there is to learn of them, the ones earned in
 * words and the rest marked locked, so what is still to find out is on the page.
 */
export function person(entry: CodexPerson): HTMLElement {
  const node = el('li', 'gb-codex-entry gb-person')
  const row = new Row({ icon: 'person', title: entry.name, line: entry.role })
  const avatar = el('span', 'gb-person-avatar')
  avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M2 12h3M19 12h3" stroke="currentColor"/></svg>`
  row.tile.replaceChildren(avatar)
  const standing = chip(DISPOSITION[entry.disposition], TONE[entry.disposition])
  standing.dataset.disposition = entry.disposition
  standing.setAttribute('aria-label', `Disposition: ${DISPOSITION[entry.disposition]}`)
  row.state.append(standing)
  if (entry.facts.length) {
    const known = entry.facts.filter((fact) => fact.text !== undefined).length
    row.state.append(el('span', 'gb-known gb-num gb-t1', factsKnown(known, entry.facts.length)))
  }
  node.append(row.node)
  if (entry.facts.length) {
    const facts = el('ul', 'gb-facts')
    facts.append(...entry.facts.map(fact))
    node.append(facts)
  }
  return node
}

function fact(entry: CodexFact): HTMLLIElement {
  const locked = entry.text === undefined
  const node = el('li', locked ? 'gb-fact-locked' : 'gb-fact')
  node.append(icon(locked ? 'lock' : 'check', ICON_PX.line), el('span', 'gb-what gb-t3', entry.text ?? LOCKED_FACT))
  return node
}
