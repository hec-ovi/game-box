import { describe, expect, it } from 'vitest'
import { flavourOf } from '../src/theme/flavour.ts'
import { wordsFor } from '../src/theme/words.ts'

/**
 * What a theme means here.
 *
 * It used to mean a mix of buildings, and it does not any more: what a building
 * is belongs to the writing, and the theme reaches it as the theme. What is
 * left in this box is the vocabulary a town names itself out of, which is what
 * the streets, the parts of town and the signs the box composes are drawn from.
 */

describe('the kind of town a theme names', () => {
  it('reads a free-text theme as one of the kinds of town it knows', () => {
    expect(flavourOf('dusty western mining town')).toBe('frontier')
    expect(flavourOf('quiet coastal town')).toBe('coastal')
    expect(flavourOf('dense neon port city')).toBe('neon')
    expect(flavourOf('a place')).toBe('plain')
  })

  it('gives every kind of town words of its own to be named out of', () => {
    const frontier = wordsFor('frontier')
    const coastal = wordsFor('coastal')

    for (const words of [frontier, coastal]) {
      for (const list of [words.nouns, words.adjectives, words.last, words.first, words.cityHeads]) expect(list.length).toBeGreaterThan(0)
    }
    expect(frontier.nouns.join()).not.toBe(coastal.nouns.join())
  })
})
