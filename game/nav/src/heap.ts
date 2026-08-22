/** A binary min-heap of cell indices, keyed by score. Enough for city-sized A*. */
export class MinHeap {
  #items: number[] = []
  #scores: Float64Array

  constructor(capacity: number) {
    this.#scores = new Float64Array(capacity)
  }

  get size(): number {
    return this.#items.length
  }

  push(item: number, score: number): void {
    this.#scores[item] = score
    this.#items.push(item)
    let child = this.#items.length - 1
    while (child > 0) {
      const parent = (child - 1) >> 1
      if (this.#scores[this.#items[parent]!]! <= score) break
      this.#items[child] = this.#items[parent]!
      this.#items[parent] = item
      child = parent
    }
  }

  pop(): number | undefined {
    const items = this.#items
    const top = items[0]
    if (top === undefined) return undefined
    const last = items.pop()!
    if (items.length === 0) return top

    items[0] = last
    const score = this.#scores[last]!
    let parent = 0
    for (;;) {
      const left = parent * 2 + 1
      const right = left + 1
      let smallest = parent
      let smallestScore = score
      if (left < items.length && this.#scores[items[left]!]! < smallestScore) {
        smallest = left
        smallestScore = this.#scores[items[left]!]!
      }
      if (right < items.length && this.#scores[items[right]!]! < smallestScore) {
        smallest = right
      }
      if (smallest === parent) break
      items[parent] = items[smallest]!
      items[smallest] = last
      parent = smallest
    }
    return top
  }
}
