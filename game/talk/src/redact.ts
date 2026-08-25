/** Entity ids look like `quest_0001`: a word, an underscore, digits. */
const ID = /\b[a-z][a-z-]*_\d{2,}\b/gi
const ARTICLE_ID = /\b(?:the|a|an) +[a-z][a-z-]*_\d{2,}\b/gi

/** A spoken line with anything machine-shaped taken out before it is heard. */
export function scrub(text: string): string {
  return text.replace(ARTICLE_ID, 'it').replace(ID, 'it').replace(/ {2,}/g, ' ')
}
