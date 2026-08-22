/** Publishes the box's JSON Schemas: what a generator must produce and what a save holds. */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gameEventContract } from '../src/events.ts'
import { questProgressContract } from '../src/progress.ts'
import { questContract, questDraftContract } from '../src/schema.ts'

const dir = join(import.meta.dirname, '..', 'schema')
for (const published of [questContract, questDraftContract, gameEventContract, questProgressContract]) {
  const out = join(dir, `${published.name}.json`)
  writeFileSync(out, `${JSON.stringify(published.jsonSchema(), null, 2)}\n`)
  console.log(`wrote ${out}`)
}
