/** Publishes the box's JSON Schema, which CONTRACT.md links to. */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { playerContract } from '../src/schema.ts'

const out = join(import.meta.dirname, '..', 'schema', 'player-state.json')
writeFileSync(out, `${JSON.stringify(playerContract.jsonSchema(), null, 2)}\n`)
console.log(`wrote ${out}`)
