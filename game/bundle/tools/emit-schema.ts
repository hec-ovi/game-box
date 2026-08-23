/** Publishes the shipped file formats: the world bundle and the save. */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PUBLISHED, schemaText } from '../src/published.ts'

const dir = join(import.meta.dirname, '..', 'schema')
for (const published of PUBLISHED) {
  const out = join(dir, `${published.name}.json`)
  writeFileSync(out, schemaText(published))
  console.log(`wrote ${out}`)
}
