/** Pins the golden cities: `pnpm run golden` rewrites tests/fixtures/golden.json from the current generator. */
import { writeFileSync } from 'node:fs'
import { goldenCases, pin } from '../tests/golden.ts'

const pins = await Promise.all(goldenCases().map(pin))
const out = new URL('../tests/fixtures/golden.json', import.meta.url)
writeFileSync(out, `${JSON.stringify(pins, null, 2)}\n`)
console.log(`pinned ${pins.length} cities to ${out.pathname}`)
