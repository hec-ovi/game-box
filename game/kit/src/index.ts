/** @gb/kit: determinism, ids, results and boundary validation. See CONTRACT.md. */
export { type Result, ok, err, expect } from './result.ts'
export { Rng } from './rng.ts'
export { IdMinter, type EntityId } from './ids.ts'
export { Contract, contract, type SchemaViolation } from './schema.ts'
