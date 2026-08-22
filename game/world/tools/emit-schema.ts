/** Publishes the box's JSON Schema, which CONTRACT.md links to and generators are constrained by. */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { worldContract } from '../src/model/schema.ts'

const out = join(import.meta.dirname, '..', 'schema', 'world.json')
writeFileSync(out, `${JSON.stringify(worldContract.jsonSchema(), null, 2)}\n`)
console.log(`wrote ${out}`)
