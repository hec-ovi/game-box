/**
 * How much of a generated town a player can actually finish today, played
 * through the verbs the running game has and no others.
 * `pnpm run playable [seed] [sizes] [theme]`.
 */
import { Forge, OfflineNarrator } from '../src/index.ts'
import { across, playEvery, type Report } from '../tests/playable.ts'
import { HANDS } from '../tests/verbs.ts'

const seed = process.argv[2] ?? 'playable'
const sizes = (process.argv[3] ?? '3,6,12,18').split(',').map(Number)
const theme = process.argv[4] ?? 'dusty western mining town'

const row = (cells: string[]) => cells.map((cell, i) => (i ? cell.padStart(14) : cell.padEnd(10))).join('')
console.log(row(['blocks', 'quests', 'completable', 'share', 'blocked by']))

const reports: Report[] = []
for (const blocks of sizes) {
  const built = await new Forge(new OfflineNarrator(`${seed}/${blocks}`)).build({ theme, seed: `${seed}/${blocks}`, blocksX: blocks, blocksY: blocks })
  if (!built.ok) {
    console.log(row([`${blocks}x${blocks}`, JSON.stringify(built.error).slice(0, 60)]))
    continue
  }
  const report = playEvery(built.value.world, built.value.quests)
  reports.push(report)
  const blockers = [...report.blockedBy].map(([kind, count]) => `${kind} ${count}`).join(', ')
  console.log(row([`${blocks}x${blocks}`, String(report.quests), String(report.completable), `${((report.completable / report.quests) * 100).toFixed(0)}%`, blockers || '-']))
}

const total = across(reports)
console.log(`\n${total.completable} of ${total.quests} quests are completable by a player today (${((total.completable / total.quests) * 100).toFixed(1)}%).`)
for (const [kind, count] of total.blockedBy) {
  const verb = total.runs.flatMap((run) => run.blocked).find((block) => block.kind === kind)?.verb
  const absent = verb ? HANDS.missing(verb) : undefined
  console.log(`  ${count} wait on a ${kind} step: ${absent ? `${absent.why} (${absent.owner})` : 'no verb for it'}`)
}
if (total.stranded.length) console.log(`  ${total.stranded.length} stop for a reason nobody owes: ${total.stranded.map((run) => run.title).join(', ')}`)
