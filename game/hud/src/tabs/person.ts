import { el } from '../dom.ts'
import { DISPOSITION, LOCKED_FACT, factsKnown } from '../phrase.ts'
import type { CodexFact, CodexPerson } from '../types.ts'

/**
 * One person in the codex: their name, how they stand towards the player,
 * what they do, and every fact there is to learn of them, the ones earned in
 * words and the rest marked locked, so what is still to find out is on the page.
 */
export function person(entry: CodexPerson): HTMLElement {
  const row = el('li', 'gb-codex-entry gb-person')
  const head = el('div', 'gb-codex-head')
  const standing = el('span', 'gb-tag gb-disposition', DISPOSITION[entry.disposition])
  standing.dataset.disposition = entry.disposition
  standing.setAttribute('aria-label', `Disposition: ${DISPOSITION[entry.disposition]}`)
  head.append(el('h4', undefined, entry.name), standing)
  if (entry.facts.length) {
    const known = entry.facts.filter((fact) => fact.text !== undefined).length
    head.append(el('span', 'gb-known', factsKnown(known, entry.facts.length)))
  }
  row.append(head)
  if (entry.role) row.append(el('p', undefined, entry.role))
  if (entry.facts.length) {
    const facts = el('ul', 'gb-facts')
    facts.append(...entry.facts.map(fact))
    row.append(facts)
  }
  return row
}

function fact(entry: CodexFact): HTMLLIElement {
  const locked = entry.text === undefined
  const node = el('li', locked ? 'gb-fact-locked' : 'gb-fact')
  node.append(el('span', 'gb-mark', locked ? '○' : '●'), el('span', 'gb-what', entry.text ?? LOCKED_FACT))
  return node
}
