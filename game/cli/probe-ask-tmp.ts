/** One city built the way the form builds it: model on, and the owner's own words for the main quest. */
import { Forge } from '@gb/forge'
import { Scribe } from '@gb/scribe'

const scribe = new Scribe({ seed: 'foster' })
const built = await new Forge(scribe).build({
  theme: 'a rain-soaked neon port city',
  seed: 'foster',
  blocksX: 3,
  blocksY: 3,
  openPlaces: 6,
  brief: 'a port town where the freight lines went automatic',
  asks: {
    mainQuest: 'the main quest is about a convict named Foster who I have to find, and I do not find him until the last moment',
    sideQuests: 'small errands for the dock crews',
    tone: 'rain, neon, tired people',
  },
})
if (!built.ok) {
  console.log('BUILD FAILED', JSON.stringify(built.error).slice(0, 500))
  process.exit(1)
}
const { world, quests } = built.value
const main = quests.find((q) => q.kind === 'main')
const npcs = new Map(world.npcs().map((n) => [n.id, n]))
console.log('\ncity:', world.name, '| interiors:', world.interiors().length, '| people:', world.npcs().length, '| quests:', quests.length)
console.log('MAIN:', main?.title)
console.log('mentions Foster:', JSON.stringify(main).toLowerCase().includes('foster'))
console.log('summary:', main?.summary?.slice(0, 240))
for (const step of main?.steps ?? []) {
  const who = 'npcId' in step ? npcs.get(step.npcId as string) : undefined
  console.log(' -', step.kind, '|', step.objective, who ? `| person: ${who.name} in ${who.station?.interiorId ?? 'nowhere'}` : '')
}
const giver = npcs.get(main?.giverNpcId ?? '')
console.log('giver:', giver?.name, '| stationed in:', giver?.station?.interiorId ?? 'NOWHERE')
