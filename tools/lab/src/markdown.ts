/**
 * Just enough markdown for a prompt file: headings, bullets, quotes,
 * paragraphs, inline code. Prompt files are written to be read as text, so the
 * rendering only has to stop the page turning them into one grey block.
 *
 * Two things are marked because they are what a reader has to be able to see at
 * a glance: `{{hole}}`, which the code fills in before the call goes out, and
 * `[slot]`, which the model is told to replace with its own word and must never
 * copy.
 */
import { el } from './dom.ts'

export function markdown(source: string): HTMLElement {
  const root = el('div', { class: 'md' })
  let list: HTMLElement | undefined
  let quote: HTMLElement | undefined
  let para: string[] = []

  const endPara = (): void => {
    if (para.length) root.appendChild(inline(el('p'), para.join(' ')))
    para = []
  }
  const endBlocks = (): void => {
    endPara()
    list = undefined
    quote = undefined
  }

  for (const raw of source.split('\n')) {
    const line = raw.trimEnd()
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    const quoted = /^>\s?(.*)$/.exec(line)

    if (line === '') {
      endBlocks()
    } else if (heading) {
      endBlocks()
      const level = Math.min(3, heading[1]!.length)
      root.appendChild(inline(el(`h${level}` as 'h3'), heading[2]!))
    } else if (bullet) {
      endPara()
      quote = undefined
      list ??= root.appendChild(el('ul'))
      list.appendChild(inline(el('li'), bullet[1]!))
    } else if (quoted) {
      endPara()
      list = undefined
      quote ??= root.appendChild(el('blockquote'))
      quote.appendChild(inline(el('p'), quoted[1]!))
    } else if (list) {
      const last = list.lastElementChild
      if (last) last.appendChild(document.createTextNode(` ${line.trim()}`))
    } else {
      quote = undefined
      para.push(line.trim())
    }
  }
  endBlocks()
  return root
}

/** Inline code, template holes and the bracketed slots, as real nodes rather than markup. */
function inline<T extends HTMLElement>(node: T, text: string): T {
  const pattern = /`([^`]+)`|(\{\{\w+\}\})|(\[[a-z][^\]]{0,40}\])/g
  let at = 0
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > at) node.appendChild(document.createTextNode(text.slice(at, match.index)))
    if (match[1] !== undefined) node.appendChild(el('code', {}, match[1]))
    else if (match[2] !== undefined) node.appendChild(el('code', {}, match[2]))
    else node.appendChild(el('span', { class: 'slot' }, match[3]!))
    at = match.index + match[0].length
  }
  if (at < text.length) node.appendChild(document.createTextNode(text.slice(at)))
  return node
}
