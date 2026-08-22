/**
 * A stable number in [0,1) from a string. The same NPC always gets the same
 * outfit and the same point in the loop, in this session and in anyone else's.
 */
export function hash01(text: string): number {
  let hash = 2166136261
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}
