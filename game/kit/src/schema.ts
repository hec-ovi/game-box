import { z } from 'zod'
import { err, ok, type Result } from './result.ts'

/** One rejected value, pointed at the exact field. */
export interface SchemaViolation {
  readonly path: string
  readonly message: string
}

/**
 * A named schema that validates at a box boundary and can publish itself as
 * JSON Schema, which is both what CONTRACT.md links to and what an LLM is
 * constrained by when it generates the data.
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
