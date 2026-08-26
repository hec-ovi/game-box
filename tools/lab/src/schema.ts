/**
 * A tool's parameters, read as a table rather than as JSON.
 *
 * The schema itself is never rewritten here: it is the object the call is
 * forced against, walked into one row per field, so the page and the wire
 * cannot say different things. What a field is for is the schema's own
 * `description`, and where the schema has none the row says so, because a model
 * decoding against it sees exactly as little.
 */
import { el, table } from './dom.ts'

export type Json = Record<string, unknown>

export interface Row {
  readonly depth: number
  readonly name: string
  readonly type: string
  readonly required: boolean
  readonly constraint: string
  readonly description: string
}

const MOST_ENUM = 10
const DEEPEST = 4

export function rowsOf(schema: Json | undefined): Row[] {
  if (!schema) return []
  const rows: Row[] = []
  walk(schema, 0, rows)
  return rows
}

function walk(node: Json, depth: number, rows: Row[]): void {
  const properties = node['properties'] as Record<string, Json> | undefined
  if (!properties) return
  const required = new Set((node['required'] as string[] | undefined) ?? [])
  for (const [name, field] of Object.entries(properties)) {
    rows.push({
      depth,
      name,
      type: typeOf(field),
      required: required.has(name),
      constraint: constraintOf(field),
      description: String(field['description'] ?? ''),
    })
    if (depth >= DEEPEST) continue
    const items = field['items'] as Json | undefined
    if (field['properties']) walk(field, depth + 1, rows)
    else if (items?.['properties']) walk(items, depth + 1, rows)
  }
}

function typeOf(field: Json): string {
  if (field['$ref']) return `-> ${String(field['$ref']).split('/').pop()}`
  if (field['const'] !== undefined) return 'const'
  if (field['enum']) return 'enum'
  const any = (field['anyOf'] ?? field['oneOf']) as Json[] | undefined
  if (any) return any.map(typeOf).join(' | ')
  const type = field['type']
  if (type === 'array') {
    const items = field['items'] as Json | undefined
    return `array of ${items ? typeOf(items) : 'anything'}`
  }
  return typeof type === 'string' ? type : 'anything'
}

function constraintOf(field: Json): string {
  const parts: string[] = []
  const push = (low: unknown, high: unknown, unit: string): void => {
    if (low === undefined && high === undefined) return
    parts.push(`${low ?? '0'} to ${high ?? 'any'} ${unit}`)
  }
  push(field['minLength'], field['maxLength'], 'chars')
  push(field['minItems'], field['maxItems'], 'items')
  if (field['minimum'] !== undefined || field['maximum'] !== undefined) {
    parts.push(`${field['minimum'] ?? '-'} to ${field['maximum'] ?? '-'}`)
  }
  if (field['pattern']) parts.push(String(field['pattern']))
  if (field['const'] !== undefined) parts.push(`= ${JSON.stringify(field['const'])}`)
  const values = field['enum'] as unknown[] | undefined
  if (values) {
    const shown = values.slice(0, MOST_ENUM).map((value) => String(value)).join(', ')
    parts.push(values.length > MOST_ENUM ? `${shown}, +${values.length - MOST_ENUM} more` : shown)
  }
  return parts.join('; ')
}

/** The rows as a table: field, type, required, constraint, what it is for. */
export function schemaTable(schema: Json | undefined): HTMLElement {
  const rows = rowsOf(schema)
  if (!rows.length) return el('p', { class: 'hint' }, 'This tool takes no parameters.')
  const described = rows.filter((row) => row.description).length
  const body = table(
    ['Field', 'Type', '', 'Constraint', 'What it is for'],
    rows.map((row) => [
      row.name,
      el('span', {}, row.type),
      el('span', { class: row.required ? 'req' : 'opt' }, row.required ? 'required' : 'optional'),
      el('span', {}, row.constraint),
      row.description
        ? el('span', {}, row.description)
        : el('span', { class: 'empty' }, 'no description in the schema'),
    ]),
    (index) => `f depth-${Math.min(4, rows[index]!.depth)}`,
  )
  for (const [index, tr] of [...body.querySelectorAll('tbody tr')].entries()) {
    tr.children[1]?.classList.add('t')
    tr.children[3]?.classList.add('c')
    tr.children[4]?.classList.add(rows[index]!.description ? 'w' : 'empty')
  }
  return el(
    'div',
    {},
    body,
    el(
      'p',
      { class: 'hint' },
      `${rows.length} fields, ${described} carrying a description the model can read, ${JSON.stringify(schema).length} characters on the wire.`,
    ),
  )
}
