import type { CheckArgs } from './args.ts'
import { checkPack, isPack } from './check-pack.ts'
import type { Io } from './index.ts'
import { openDocument, readJson } from './open.ts'
import { walk } from './walk.ts'

/** Open a bundle the way the game would and say what is wrong with it; for a pack, say what it names and what it adds. */
export async function check(args: CheckArgs, io: Io): Promise<number> {
  if (!args.file) {
    io.err('check needs a bundle or pack file')
    return 1
  }
  const read = readJson(args.file)
  if ('unreadable' in read) {
    io.err(`${args.file} cannot be read: ${read.unreadable}`)
    return 1
  }
  if (isPack(read.document)) return checkPack(args.file, read.document, args.base, io)

  const opened = await openDocument(args.file, read.document, io)
  if (!opened) return 1

  const { world, quests } = opened
  io.out(`${world.name}: sound`)
  io.out(`  ${world.plots().length} buildings, ${world.npcs().length} people, ${quests.length} quests`)
  io.out(`  content ${opened.contentHash.slice(0, 12)}`)
  return walk(world, io) ? 0 : 1
}
