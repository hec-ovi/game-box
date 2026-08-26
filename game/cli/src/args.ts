import { STOREYS_DEFAULT } from '@gb/forge'
import { parseArgs } from 'node:util'

/** What each command is handed, read off its argv. */
export interface BuildArgs {
  theme: string
  seed: string
  blocks: string
  cells?: string
  density: string
  storeys: string
  exits: string
  model: boolean
  history?: string
  out: string
}

export interface ExtendArgs {
  base: string | undefined
  count: string
  model: boolean
  out: string
}

export interface PackArgs {
  base: string | undefined
  extended: string | undefined
  out: string
}

export interface ApplyArgs {
  base: string | undefined
  pack: string | undefined
  out: string
}

export interface CheckArgs {
  file: string | undefined
  base?: string
}

export function parseBuild(argv: readonly string[]): BuildArgs {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      theme: { type: 'string', default: 'quiet coastal town' },
      seed: { type: 'string', default: 'town' },
      blocks: { type: 'string', default: '3x3' },
      cells: { type: 'string' },
      density: { type: 'string', default: '0.8' },
      storeys: { type: 'string', default: String(STOREYS_DEFAULT) },
      exits: { type: 'string', default: '1' },
      model: { type: 'boolean', default: false },
      history: { type: 'string' },
      out: { type: 'string', default: 'city.json' },
    },
    allowPositionals: false,
  })
  return values as BuildArgs
}

export function parseExtend(argv: readonly string[]): ExtendArgs {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: {
      count: { type: 'string', default: '10' },
      model: { type: 'boolean', default: false },
      out: { type: 'string', default: 'extended.json' },
    },
    allowPositionals: true,
  })
  return { ...(values as Omit<ExtendArgs, 'base'>), base: positionals[0] }
}

export function parsePack(argv: readonly string[]): PackArgs {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: { out: { type: 'string', default: 'pack.json' } },
    allowPositionals: true,
  })
  return { ...(values as Omit<PackArgs, 'base' | 'extended'>), base: positionals[0], extended: positionals[1] }
}

export function parseApply(argv: readonly string[]): ApplyArgs {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: { out: { type: 'string', default: 'city.json' } },
    allowPositionals: true,
  })
  return { ...(values as Omit<ApplyArgs, 'base' | 'pack'>), base: positionals[0], pack: positionals[1] }
}

export function parseCheck(argv: readonly string[]): CheckArgs {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: { base: { type: 'string' } },
    allowPositionals: true,
  })
  return { ...(values as Omit<CheckArgs, 'file'>), file: positionals[0] }
}
