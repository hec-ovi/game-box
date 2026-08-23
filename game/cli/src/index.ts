import { parseArgs } from 'node:util'
import { build } from './build.ts'
import { check } from './check.ts'
import { inspect } from './inspect.ts'

/** Where output goes. Injected so the commands are testable without a terminal. */
export interface Io {
  out(line: string): void
  err(line: string): void
}

const USAGE = `gb - build and inspect game-box cities

  gb build [options]        generate a city and write it as a bundle
    --theme <text>          what kind of city (default: "quiet coastal town")
    --seed <text>           same seed, same city (default: "town")
    --blocks <n>x<n>        city blocks across and down (default: 3x3)
    --cells <n>             cells per block side, 2m each (default: the seed picks)
    --density <0..1>        how much of each block gets built on (default: 0.8)
    --storeys <n>           tallest building allowed (default: 3)
    --exits <1..4>          how many roads lead out of town (default: 1)
    --model                 use the local model for names and quests, not the offline narrator
    --out <file>            where to write it (default: city.json)

  gb inspect <file>         print a bundle: its grid, its places, its quests
  gb check <file>           open a bundle and report anything wrong with it
`

export async function run(argv: readonly string[], io: Io): Promise<number> {
  const [command, ...rest] = argv
  switch (command) {
    case 'build':
      return build(parse(rest), io)
    case 'inspect':
      return inspect(rest[0], io)
    case 'check':
      return check(rest[0], io)
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      io.out(USAGE)
      return command === undefined ? 1 : 0
    default:
      io.err(`unknown command: ${command}`)
      io.err(USAGE)
      return 1
  }
}

export interface BuildArgs {
  theme: string
  seed: string
  blocks: string
  cells?: string
  density: string
  storeys: string
  exits: string
  model: boolean
  out: string
}

function parse(argv: readonly string[]): BuildArgs {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      theme: { type: 'string', default: 'quiet coastal town' },
      seed: { type: 'string', default: 'town' },
      blocks: { type: 'string', default: '3x3' },
      cells: { type: 'string' },
      density: { type: 'string', default: '0.8' },
      storeys: { type: 'string', default: '3' },
      exits: { type: 'string', default: '1' },
      model: { type: 'boolean', default: false },
      out: { type: 'string', default: 'city.json' },
    },
    allowPositionals: false,
  })
  return values as BuildArgs
}
