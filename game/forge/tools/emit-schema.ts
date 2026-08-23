/** Publishes the schemas: what you ask for when you want a city, and what a narrator writes it against. */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { briefContract } from '../src/brief.ts'
import { premiseContract } from '../src/premise/shape.ts'

for (const [name, contract] of [
  ['brief', briefContract],
  ['premise', premiseContract],
] as const) {
  const out = join(import.meta.dirname, '..', 'schema', `${name}.json`)
  writeFileSync(out, `${JSON.stringify(contract.jsonSchema(), null, 2)}\n`)
  console.log(`wrote ${out}`)
}
