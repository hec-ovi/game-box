/**
 * SHA-256 over bytes, as lowercase hex. `crypto.subtle` is the one digest both
 * the browser and Node have, so the pack is checked the same way wherever it is
 * read.
 */
export async function sha256(data: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
