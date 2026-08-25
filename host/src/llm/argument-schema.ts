import { z } from 'zod'
import type { Tool } from './schema.ts'

type JsonSchema = Parameters<typeof z.fromJSONSchema>[0]

/**
 * A tool's parameters as something that can say yes or no to a value, built
 * with the same zod the boundaries validate with. A schema zod cannot read
 * (`not`, `if`/`then`, `unevaluatedProperties`, `dependentRequired`, an
 * external `$ref`) accepts nothing: what cannot be checked is not passed on.
 */
export class ArgumentSchema {
  readonly #schema: z.ZodType | undefined

  constructor(tool: Tool) {
    this.#schema = readable(tool.function.parameters as JsonSchema)
  }

  accepts(value: unknown): boolean {
    return this.#schema !== undefined && this.#schema.safeParse(value).success
  }
}

function readable(parameters: JsonSchema): z.ZodType | undefined {
  try {
    return z.fromJSONSchema(parameters)
  } catch {
    return undefined
  }
}
