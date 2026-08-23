import type { Carried } from './types.ts'

/** What a live quest wants reads first: it is the thing not to sell or drop. */
export function questFirst(carrying: readonly Carried[]): readonly Carried[] {
  return [...carrying].sort((a, b) => Number(Boolean(b.quest)) - Number(Boolean(a.quest)))
}
