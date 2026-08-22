/** Publishes the shipped file formats: the world bundle and the save. */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bundleContract, saveContract } from '../src/schema.ts'

const dir = join(import.meta.dirname, '..', 'schema')
for (const published of [bundleContract, saveContract]) {
  const out = join(dir, `${published.name}.json`)
  writeFileSync(out, `${JSON.stringify(published.jsonSchema(), null, 2)}\n`)
  console.log(`wrote ${out}`)
}
