#!/usr/bin/env -S node --experimental-transform-types
/** The terminal entry point. Everything it does lives in run(). */
import { run } from './index.ts'

const code = await run(process.argv.slice(2), {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
})
process.exit(code)
