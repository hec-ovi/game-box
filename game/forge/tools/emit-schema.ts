/** Publishes the brief schema: what you ask for when you want a city. */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { briefContract } from '../src/brief.ts'

const out = join(import.meta.dirname, '..', 'schema', 'brief.json')
writeFileSync(out, `${JSON.stringify(briefContract.jsonSchema(), null, 2)}\n`)
console.log(`wrote ${out}`)
