import { describe, expect, it } from 'vitest'
import { Stall } from '../src/stall.ts'

/**
 * The watch on the frame loop. It exists to catch a stall nobody can reproduce
 * on demand, so what matters is that it is silent on a good frame, that it
 * names the segment that cost the time on a bad one, and that a bad stretch
 * cannot bury the console.
 */
describe('the watch on a slow frame', () => {
  /** A clock the test winds by hand, and everything the watch said. */
  function watching(over = 100) {
    let clock = 0
    const said: string[] = []
    const stall = new Stall({ over, say: (line) => said.push(line), now: () => clock })
    return { said, stall, wind: (ms: number) => void (clock += ms) }
  }

  it('says nothing about a frame the player never felt', () => {
    const { said, stall, wind } = watching()
    stall.begin()
    wind(4)
    stall.at('city')
    wind(3)
    stall.end()
    expect(said).toEqual([])
  })

  it('names where a slow frame went, worst first, and leaves out the segments that cost nothing', () => {
    const { said, stall, wind } = watching()
    stall.begin()
    wind(0.2)
    stall.at('clock')
    wind(900)
    stall.at('city')
    wind(6)
    stall.at('cast')
    wind(40)
    stall.end() // the draw

    expect(said).toHaveLength(1)
    expect(said[0]).toBe('slow frame 946 ms: city 900, draw 40, cast 6')
    // the segment that cost a fifth of a millisecond is not in the line
    expect(said[0]).not.toContain('clock')
  })

  it('says it once while a bad stretch lasts, rather than once a frame', () => {
    const { said, stall, wind } = watching()
    for (let frame = 0; frame < 5; frame++) {
      stall.begin()
      wind(500)
      stall.at('city')
      stall.end()
    }
    expect(said).toHaveLength(2)
  })
})
