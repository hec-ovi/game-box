/** The whole of the page's element building. No framework: one function that makes a node. */

type Child = Node | string | number | null | undefined | false

export interface Attrs {
  readonly class?: string
  readonly title?: string
  readonly type?: string
  readonly value?: string
  readonly placeholder?: string
  readonly rows?: string
  readonly min?: string
  readonly max?: string
  readonly step?: string
  readonly disabled?: boolean
  readonly open?: boolean
  readonly colspan?: string
  readonly role?: string
  readonly 'aria-selected'?: string
  readonly onclick?: (event: MouseEvent) => void
  readonly oninput?: (event: Event) => void
  readonly onchange?: (event: Event) => void
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value as EventListener)
    else if (value === true) node.setAttribute(key, '')
    else node.setAttribute(key, String(value))
  }
  add(node, children)
  return node
}

export function add(node: Node, children: readonly Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue
    node.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)))
  }
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild)
}

/** A bordered box with a title, the shape every section of a stage is drawn in. */
export function panel(title: string, note: string | undefined, ...children: Child[]): HTMLElement {
  const body = el('div', { class: 'body' })
  add(body, children)
  return el('section', { class: 'panel' }, el('header', {}, el('h2', {}, title), note && el('span', { class: 'note' }, note)), body)
}

/** A collapsed section: the label, the file it came from, and what is inside. */
export function fold(label: string, path: string | undefined, open: boolean, ...children: Child[]): HTMLElement {
  const inner = el('div', { class: 'inner' })
  add(inner, children)
  return el('details', open ? { open: true } : {}, el('summary', {}, label, path && el('span', { class: 'path' }, path)), inner)
}

export function table(headings: readonly string[], rows: readonly (readonly Child[])[], rowClass?: (index: number) => string | undefined): HTMLElement {
  const head = el('tr')
  for (const heading of headings) head.appendChild(el('th', {}, heading))
  const body = el('tbody')
  for (const [index, cells] of rows.entries()) {
    const tr = el('tr')
    for (const [column, cell] of cells.entries()) {
      const klass = column === 0 ? rowClass?.(index) : undefined
      tr.appendChild(el('td', klass ? { class: klass } : {}, cell))
    }
    body.appendChild(tr)
  }
  return el('table', {}, el('thead', {}, head), body)
}

export function pre(text: string, tall = false): HTMLElement {
  return el('pre', tall ? { class: 'tall' } : {}, text)
}

export function json(value: unknown, tall = false): HTMLElement {
  return pre(JSON.stringify(value, null, 2) ?? String(value), tall)
}

export function field(label: string, control: HTMLElement, span = false): HTMLElement {
  return el('div', { class: span ? 'field span' : 'field' }, el('label', {}, label), control)
}

export function chips(values: readonly string[]): HTMLElement {
  return el('div', { class: 'chips' }, ...values.map((value) => el('span', { class: 'chip' }, value)))
}
