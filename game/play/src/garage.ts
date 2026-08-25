/** The cars the player keeps, by model, and which one is out on the street. */
import { err, ok, type Result } from '@gb/kit'
import { named } from './named.ts'
import type { GarageDoc } from './schema.ts'

export type GarageError = { readonly code: 'missing-car'; readonly model: string }

export class Garage {
  #kept: string[] = []
  #out: string | undefined

  /** Restore from a save, each model once. A car out that is not kept is put away. */
  static from(doc: GarageDoc | undefined): Garage {
    const garage = new Garage()
    for (const model of doc?.kept ?? []) garage.keep(model)
    if (doc?.out !== undefined) garage.takeOut(doc.out)
    return garage
  }

  /** A car is the player's now. The same model twice is one car; a nameless model is ignored. */
  keep(model: string): void {
    if (named(model) && !this.has(model)) this.#kept.push(model)
  }

  has(model: string): boolean {
    return this.#kept.includes(model)
  }

  /** Bring one out; whichever was out goes back in. Refused when the player does not keep it. */
  takeOut(model: string): Result<void, GarageError> {
    if (!this.has(model)) return err({ code: 'missing-car', model })
    this.#out = model
    return ok(undefined)
  }

  /** Nothing out on the street. */
  putAway(): void {
    this.#out = undefined
  }

  /** The model out on the street, if one is. */
  get out(): string | undefined {
    return this.#out
  }

  list(): readonly string[] {
    return [...this.#kept]
  }

  get any(): boolean {
    return this.#kept.length > 0
  }

  toJSON(): GarageDoc {
    const doc: GarageDoc = { kept: [...this.#kept] }
    if (this.#out !== undefined) doc.out = this.#out
    return doc
  }
}
