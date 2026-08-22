/**
 * Strict base64: Node's decoder silently skips characters it does not know, so
 * a chunk that is not really base64 has to be caught before it is decoded.
 */
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

export function decodeBase64(text: string): Buffer | undefined {
  if (!BASE64.test(text)) return undefined
  return Buffer.from(text, 'base64')
}
