/** Publishes the theme pack format, which CONTRACT.md links to and a pack author validates against. */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { themeContract } from '../src/theme.ts'

const out = join(import.meta.dirname, '..', 'schema', 'theme.json')
writeFileSync(out, `${JSON.stringify(themeContract.jsonSchema(), null, 2)}\n`)
console.log(`wrote ${out}`)
