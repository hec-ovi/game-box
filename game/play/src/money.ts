/** What the player can afford: credits that never go below zero. */
import { err, ok, type Result } from '@gb/kit'

export type MoneyError =
  | { readonly code: 'invalid-amount'; readonly amount: number }
  | { readonly code: 'not-enough-money'; readonly needed: number; readonly held: number }

/** A whole number of credits, zero or more; anything else is not a price. */
const isAmount = (amount: number): boolean => Number.isInteger(amount) && amount >= 0

export class Purse {
  #credits: number

  constructor(credits: number) {
    this.#credits = credits
  }

  get balance(): number {
    return this.#credits
  }

  /** A reward. Anything that is not a whole positive number adds nothing. */
  earn(amount: number): void {
    if (Number.isFinite(amount)) this.#credits += Math.max(0, Math.trunc(amount))
  }

  /** Hand credits over. A refused payment deducts nothing. */
  pay(amount: number): Result<void, MoneyError> {
    if (!isAmount(amount)) return err({ code: 'invalid-amount', amount })
    if (this.#credits < amount) return err({ code: 'not-enough-money', needed: amount, held: this.#credits })
    this.#credits -= amount
    return ok(undefined)
  }
}
