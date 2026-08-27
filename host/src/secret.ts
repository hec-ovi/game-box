/**
 * A credential must never come back out, whatever a transport error or an
 * upstream body put in its message, so every text this service reports is
 * pushed through here first.
 */

const MASK = '***'

/**
 * Six characters, because a provider can echo the key back part-masked
 * (`sk-not-a************-key`, measured from OpenAI) and its head and tail are
 * still the key. Anything shorter than a run this long is the four trailing
 * characters a dashboard prints as a name, not the secret.
 */
const REVEALING = 6

export function scrub(text: string, secret: string | undefined): string {
  if (secret === undefined || secret === '') return text
  let out = text.split(secret).join(MASK)
  for (let start = 0; start + REVEALING <= secret.length; start += 1) {
    const run = secret.slice(start, start + REVEALING)
    if (out.includes(run)) out = out.split(run).join(MASK)
  }
  return out
}
