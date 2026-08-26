import { STOREYS_DEFAULT } from '@gb/forge'
import { apply } from './apply.ts'
import { parseApply, parseBuild, parseCheck, parseExtend, parsePack } from './args.ts'
import { build } from './build.ts'
import { check } from './check.ts'
import { extend } from './extend.ts'
import { inspect } from './inspect.ts'
import { pack } from './pack.ts'

/** Where output goes. Injected so the commands are testable without a terminal. */
export interface Io {
  out(line: string): void
  err(line: string): void
}

const USAGE = `gb - build, grow and inspect game-box cities

  gb build [options]        generate a city and write it as a bundle
    --theme <text>          what kind of city (default: "quiet coastal town")
    --seed <text>           same seed, same city (default: "town")
    --blocks <n>x<n>        city blocks across and down (default: 3x3)
    --cells <n>             cells per block side, 2m each (default: the seed picks)
    --density <0..1>        how much of each block gets built on (default: 0.8)
    --storeys <n>           tallest building allowed, 1 to 40 (default: ${STOREYS_DEFAULT}); over 4 the city grows a skyline
    --exits <1..4>          how many roads lead out of town (default: 1)
    --model                 use the local model for names and quests, not the offline narrator
    --history <file>        build to a history you wrote (JSON: the premise and the charters it declares)
    --out <file>            where to write it (default: city.json)

  gb extend <base> [options]         grow a finished city into a new bundle, the base untouched
    --count <n>             how many buildings to add (default: 10)
    --model                 use the local model for the new places, not the offline narrator
    --out <file>            where to write the grown city (default: extended.json)

  gb pack <base> <extended> [--out <file>]   cut what the growth added into a pack (default: pack.json)
  gb apply <base> <pack> [--out <file>]      apply a pack to its base and write the grown city (default: city.json)

  gb inspect <file>         print a bundle: its grid, its places, its quests
  gb check <file>           open a bundle and report anything wrong with it; for a pack, say which base it names
    --base <file>           for a pack: apply it to this base and check the city that gives
`

export async function run(argv: readonly string[], io: Io): Promise<number> {
  const [command, ...rest] = argv
  try {
    switch (command) {
      case 'build':
        return await build(parseBuild(rest), io)
      case 'extend':
        return await extend(parseExtend(rest), io)
      case 'pack':
        return await pack(parsePack(rest), io)
      case 'apply':
        return await apply(parseApply(rest), io)
      case 'inspect':
        return await inspect(rest[0], io)
      case 'check':
        return await check(parseCheck(rest), io)
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
  } catch (cause) {
    // an option parseArgs will not take is the one thing left that throws
    io.err(`cannot read the arguments: ${(cause as Error).message}`)
    io.err(USAGE)
    return 1
  }
}
