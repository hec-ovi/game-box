/**
 * What a fresh player walks into. Counts the jobs on offer before anything has
 * been done, how many of the town's open doors have work behind them, and how
 * far they have to walk from where they open their eyes before somebody gives
 * them something. `pnpm run reach [blocks] [seeds]`.
 */
import { PlayerState } from '@gb/play'
import { QuestLog } from '@gb/quest'
import { Forge, OfflineNarrator } from '../src/index.ts'

const blocks = Number(process.argv[2] ?? 6)
const seeds = (process.argv[3] ?? 'dry-gulch,story-town,doors-big,vary-1,vary-2,vary-3,scale-same,alpha,beta,gamma').split(',')
const theme = process.argv[4] ?? 'dusty western mining town'

const row = (cells: string[]) => cells.map((cell, i) => (i ? cell.padStart(10) : cell.padEnd(12))).join('')
console.log(row(['seed', 'plots', 'open', 'quests', 'offered', 'doors now', 'first six', 'doors to 1']))

const offeredCounts: number[] = []
const shares: number[] = []
const walks: number[] = []
const sixes: number[] = []

for (const seed of seeds) {
  const built = await new Forge(new OfflineNarrator(seed)).build({ theme, seed, blocksX: blocks, blocksY: blocks })
  if (!built.ok) {
    console.log(`${seed.padEnd(12)}refused`)
    continue
  }
  const { world, quests } = built.value
  const player = PlayerState.create(world.id, 200)
  const log = QuestLog.create(quests, player)
  const givers = [...new Set(quests.map((quest) => quest.giverNpcId))]
  const offered = givers.flatMap((giver) => log.offeredBy(giver))

  const plotOf = new Map(world.interiors().map((interior) => [interior.id, interior.plotId]))
  const homeOf = new Map(world.npcs().filter((npc) => npc.station).map((npc) => [npc.id, plotOf.get(npc.station!.interiorId)!]))
  const offering = new Set(offered.map((quest) => homeOf.get(quest.giverNpcId)))

  // the player opens their eyes at the first door in town that opens, and tries
  // the doors that open in the order they come to them
  const shut = new Set([...plotOf.values()])
  const doors = world.plots().filter((plot) => shut.has(plot.id))
  const from = doors[0]!.entrance.cell
  const walked = doors
    .slice(1)
    .sort((a, b) => Math.hypot(a.entrance.cell.x - from.x, a.entrance.cell.y - from.y) - Math.hypot(b.entrance.cell.x - from.x, b.entrance.cell.y - from.y))
  const tried = [doors[0]!, ...walked]
  const firstSix = tried.slice(0, 6).filter((plot) => offering.has(plot.id)).length
  const toFirst = tried.findIndex((plot) => offering.has(plot.id)) + 1

  offeredCounts.push(offered.length)
  shares.push(offering.size / Math.max(1, world.interiors().length))
  sixes.push(firstSix)
  if (toFirst > 0) walks.push(toFirst)
  console.log(
    row([
      seed,
      String(world.plots().length),
      String(world.interiors().length),
      String(quests.length),
      String(offered.length),
      String(offering.size),
      `${firstSix}/6`,
      toFirst > 0 ? String(toFirst) : 'never',
    ]),
  )
}

const mean = (values: number[]) => values.reduce((sum, one) => sum + one, 0) / Math.max(1, values.length)
console.log(
  `\n${blocks}x${blocks}: ${Math.min(...offeredCounts)} to ${Math.max(...offeredCounts)} jobs on offer at the start, mean ${mean(offeredCounts).toFixed(1)}; ` +
    `${(mean(shares) * 100).toFixed(0)}% of the open doors have work behind them; ` +
    `${mean(sixes).toFixed(1)} jobs in the first six doors, ${mean(walks).toFixed(1)} doors to the first`,
)
