/** Entity ids look like `quest_0001`: a word, an underscore, digits. */
const ID = /\b[a-z][a-z-]*_\d{2,}\b/gi
const ARTICLE_ID = /\b(?:the|a|an) +[a-z][a-z-]*_\d{2,}\b/gi
/** An article at the very end of the buffer may belong to an id still arriving. */
const TRAILING_ARTICLE = /(?:^|\s)(?:the|a|an) +$/i

/**
 * Keeps machine detail out of a spoken line while it streams. An id can arrive
 * split across two chunks, so the tail of the buffer is held back until the
 * word it belongs to is complete: an id has no spaces in it, and one word of
 * delay is not audible.
 */
export class Redactor {
  #held = ''

  /** The part of the stream that is safe to say out loud now. */
  push(chunk: string): string {
    this.#held += chunk
    const end = settled(this.#held)
    if (end <= 0) return ''
    const ready = this.#held.slice(0, end)
    this.#held = this.#held.slice(end)
    return scrub(ready)
  }

  /** Whatever is left when the stream ends. */
  flush(): string {
    const rest = scrub(this.#held)
    this.#held = ''
    return rest
  }
}

/** How much of the buffer can no longer turn out to be part of an id. */
function settled(text: string): number {
  let end = 0
  for (let i = text.length - 1; i >= 0; i--) {
    if (/\s/.test(text[i]!)) {
      end = i + 1
      break
    }
  }
  if (!end) return 0
  const article = TRAILING_ARTICLE.exec(text.slice(0, end))
  if (!article) return end
  return article.index === 0 ? 0 : article.index + 1
}

function scrub(text: string): string {
  return text.replace(ARTICLE_ID, 'it').replace(ID, 'it').replace(/ {2,}/g, ' ')
}
