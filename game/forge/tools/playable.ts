/**
 * How much of a generated town a player can actually finish today, played
 * through the verbs the running game has and no others, in a town where a
 * third of the people are out walking the way the running game sends them.
 * `pnpm run playable [seed] [sizes] [theme]`.
 */
import { Forge, OfflineNarrator } from '../src/index.ts'
import { across, line, playEvery, type Report, type Town } from '../tests/playable.ts'
import { HANDS } from '../tests/verbs.ts'

const seed = process.argv[2] ?? 'playable'
const sizes = (process.argv[3] ?? '3,6,12,18').split(',').map(Number)
const theme = process.argv[4] ?? 'dusty western mining town'

/** Everybody at their post; a third out with the quest's people kept in; a third out and nobody kept. */
const TOWNS: readonly Town[] = ['at-post', 'kept', 'loose']

const row = (cells: string[]) => cells.map((cell, i) => (i ? cell.padStart(14) : cell.padEnd(10))).join('')
console.log(row(['blocks', 'quests', ...TOWNS, 'blocked by']))

const reports = new Map<Town, Report[]>(TOWNS.map((town) => [town, []]))
for (const blocks of sizes) {
  const built = await new Forge(new OfflineNarrator(`${seed}/${blocks}`)).build({ theme, seed: `${seed}/${blocks}`, blocksX: blocks, blocksY: blocks })
  if (!built.ok) {
    console.log(row([`${blocks}x${blocks}`, JSON.stringify(built.error).slice(0, 60)]))
    continue
  }
  const played = TOWNS.map((town) => {
    const report = playEvery(built.value.world, built.value.quests, town)
    reports.get(town)!.push(report)
    return report
  })
  const blockers = [...played[0]!.blockedBy].map(([kind, count]) => `${kind} ${count}`).join(', ')
  console.log(row([`${blocks}x${blocks}`, String(played[0]!.quests), ...played.map((report) => `${report.completable} (${((report.completable / report.quests) * 100).toFixed(0)}%)`), blockers || '-']))
}

for (const town of TOWNS) console.log(`\n${town}: ${line(across(reports.get(town)!))}`)
const total = across(reports.get('at-post')!)
for (const [kind, count] of total.blockedBy) {
  const verb = total.runs.flatMap((run) => run.blocked).find((block) => block.kind === kind)?.verb
  const absent = verb ? HANDS.missing(verb) : undefined
  console.log(`  ${count} wait on a ${kind} step: ${absent ? `${absent.why} (${absent.owner})` : 'no verb for it'}`)
}
if (total.stranded.length) console.log(`  ${total.stranded.length} stop for a reason nobody owes: ${total.stranded.map((run) => run.title).join(', ')}`)
