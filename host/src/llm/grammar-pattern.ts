/**
 * A JSON Schema `pattern` in the form llama.cpp's grammar enforces exactly,
 * or nothing when it cannot.
 *
 * The grammar copies a character class into the string rule as it is, so a
 * class that matches a quote (`[^{}]`, `.`) lets the model write the closing
 * quote without closing the string, and a reply that then drifts off the
 * schema can never write `}` again: it runs until the context is full. An
 * escape it does not know (`\d`, `\s`, `\w`) makes it accept any string, and
 * whenever a pattern is present it ignores `minLength` and `maxLength`. So a
 * pattern is sent only when every part of it is one the grammar reads as the
 * regex means it, with `\d` written as the class it stands for.
 */
export class GrammarPattern {
  static readonly #ATOM = String.raw`[^\\"^$.\[\](){}|*+?]|\\[.\[\](){}|*+?^$]|\[[^\\\]"^][^\\\]"]*\]|\(\?:|[()|]`
  static readonly #QUANTIFIER = String.raw`[*+?]|\{\d+(?:,\d*)?\}`
  static readonly #ENFORCEABLE = new RegExp(`^\\^(?:(?:${GrammarPattern.#ATOM})(?:${GrammarPattern.#QUANTIFIER})?)*\\$$`)

  /** The pattern the grammar is handed, or `undefined` to leave the string to its length bounds. */
  static enforceable(pattern: string): string | undefined {
    const spelled = pattern.replace(/\\(.)/g, (escape, char: string) => (char === 'd' ? '[0-9]' : escape))
    return GrammarPattern.#ENFORCEABLE.test(spelled) ? spelled : undefined
  }
}
