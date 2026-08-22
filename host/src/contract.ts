import { z } from 'zod'
import { err, ok, type Result } from './result.ts'

/** One rejected value, pointed at the exact field. */
export interface SchemaViolation {
  readonly path: string
  readonly message: string
}

/**
 * A named schema that validates at a boundary and publishes itself as JSON
 * Schema, so what `schema/` documents and what the code enforces are the same
 * object. This service carries its own copy on purpose: it is a standalone
 * folder and depends on nothing but zod.
 */
export class Contract<T> {
  readonly name: string
  readonly schema: z.ZodType<T>

  constructor(name: string, schema: z.ZodType<T>) {
    this.name = name
    this.schema = schema
  }

  parse(value: unknown): Result<T, SchemaViolation[]> {
    const parsed = this.schema.safeParse(value)
    if (parsed.success) return ok(parsed.data)
    return err(
      parsed.error.issues.map((issue) => ({
        path: issue.path.length ? issue.path.join('.') : '(root)',
        message: issue.message,
      })),
    )
  }

  is(value: unknown): value is T {
    return this.schema.safeParse(value).success
  }

  jsonSchema(): Record<string, unknown> {
    return z.toJSONSchema(this.schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>
  }
}

export function contract<T>(name: string, schema: z.ZodType<T>): Contract<T> {
  return new Contract(name, schema)
}

/** Violations as one line, for an error body that has room for a string only. */
export function violationText(violations: readonly SchemaViolation[]): string {
  return violations.map((v) => `${v.path}: ${v.message}`).join('; ') || 'request failed schema validation'
}
