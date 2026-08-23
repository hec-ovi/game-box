/**
 * A binary min-heap of cell indices. Its arrays live as long as the search that
 * owns it: `clear` costs nothing, so a street full of NPCs asking for routes
 * allocates nothing after the first few. A score is stored per heap slot, not
 * per cell, so improving a cell that is already queued cannot silently
 * re-key the copy already in the heap.
 */
export class MinHeap {
  #items: Int32Array
  #scores: Float64Array
  #size = 0

  constructor(capacity = 256) {
    this.#items = new Int32Array(Math.max(1, capacity))
    this.#scores = new Float64Array(Math.max(1, capacity))
  }

  get size(): number {
    return this.#size
  }

  clear(): void {
    this.#size = 0
  }

  push(item: number, score: number): void {
    if (this.#size === this.#items.length) this.#grow()
    const items = this.#items
    const scores = this.#scores
    let child = this.#size++
    while (child > 0) {
      const parent = (child - 1) >> 1
      if (scores[parent]! <= score) break
      items[child] = items[parent]!
      scores[child] = scores[parent]!
      child = parent
    }
    items[child] = item
    scores[child] = score
  }

  /** The lowest-scoring cell, or -1 when the heap is empty. */
  pop(): number {
    if (this.#size === 0) return -1
    const items = this.#items
    const scores = this.#scores
    const top = items[0]!
    const last = --this.#size
    if (last === 0) return top

    const item = items[last]!
    const score = scores[last]!
    let parent = 0
    for (;;) {
      const left = parent * 2 + 1
      if (left >= last) break
      const right = left + 1
      let smallest = left
      if (right < last && scores[right]! < scores[left]!) smallest = right
      if (scores[smallest]! >= score) break
      items[parent] = items[smallest]!
      scores[parent] = scores[smallest]!
      parent = smallest
    }
    items[parent] = item
    scores[parent] = score
    return top
  }

  #grow(): void {
    const items = new Int32Array(this.#items.length * 2)
    const scores = new Float64Array(this.#scores.length * 2)
    items.set(this.#items)
    scores.set(this.#scores)
    this.#items = items
    this.#scores = scores
  }
}
