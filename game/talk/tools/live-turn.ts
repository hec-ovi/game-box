import { PlayerState } from '@gb/play'
import { QuestLog } from '@gb/quest'
import { Sidecar } from '@gb/sidecar'
import { World } from '@gb/world'
import { readFileSync } from 'node:fs'
import { Conversation, Sessions } from '../src/index.ts'

/** One real turn against the running model, with what it cost. */
const file = process.argv[2]
if (!file) throw new Error('usage: live-turn <world.json>')
const doc = JSON.parse(readFileSync(file, 'utf8'))
const loaded = World.load(doc.world ?? doc)
if (!loaded.ok) throw new Error(JSON.stringify(loaded.error))
const world = loaded.value
const npc = world.npcs()[0]
if (!npc) throw new Error('nobody in this city')

const player = PlayerState.create(world.id)
const log = QuestLog.create([], player)

let promptChars = 0
let systemChars = 0
const sidecar = new Sidecar({
  base: process.env.GAME_BOX_URL ?? 'http://127.0.0.1:8976',
  fetch: (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    systemChars = String(body.messages?.[0]?.content ?? '').length
    promptChars = body.messages.reduce((n: number, m: { content?: string }) => n + String(m.content ?? '').length, 0)
    return globalThis.fetch(url, init)
  }) as unknown as typeof globalThis.fetch,
})

const opened = await Conversation.open({ world, log, player, sidecar, npcId: npc.id, sessions: new Sessions() })
if (!opened.ok) throw new Error(JSON.stringify(opened.error))
console.log(`${npc.name}, ${npc.role} — opening: "${opened.value.opening.line}"`)

const started = performance.now()
let says = ''
let first = 0
for await (const event of opened.value.conversation.say('quiet in here.')) {
  if (event.kind === 'turn' && event.says) {
    first ||= performance.now()
    says += event.says
  }
}
const took = performance.now() - started
console.log(`  system prompt: ${systemChars} chars (~${Math.round(systemChars / 4)} tokens)`)
console.log(`  whole request: ${promptChars} chars (~${Math.round(promptChars / 4)} tokens)`)
console.log(`  reply: ${says.length} chars (~${Math.round(says.length / 4)} tokens)`)
console.log(`  first token after ${first ? ((first - started) / 1000).toFixed(1) : '?'}s, whole turn ${(took / 1000).toFixed(1)}s`)
console.log(`  said: ${says}`)
