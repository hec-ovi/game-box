import type { Contract } from '@gb/kit'
import type { JsonSchema } from './compact.ts'

/**
 * A contract that validates exactly like the one it wraps but hands the model a
 * different JSON Schema: the same shape, or a narrower one, written shorter.
 * Validation still runs against the original, so nothing the model gets away
 * with here gets past the contract.
 */
export class ToolContract<T> implements Contract<T> {
  readonly name: string
  readonly schema: Contract<T>['schema']
  #source: Contract<T>
  #json: JsonSchema

  constructor(source: Contract<T>, json: JsonSchema) {
    this.name = source.name
    this.schema = source.schema
    this.#source = source
    this.#json = json
  }

  parse(value: unknown): ReturnType<Contract<T>['parse']> {
    return this.#source.parse(value)
  }

  is(value: unknown): value is T {
    return this.#source.is(value)
  }

  jsonSchema(): JsonSchema {
    return this.#json
  }
}
